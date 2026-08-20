import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ChatMessageType, ChatRoomStatus, ChatSenderRole, Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/services';
import { UserRole } from '../../shared/types';
import { StorageService } from '../storage/storage.service';
import { isQuizRequiredForSlug } from '../quiz/quiz-definitions';
import { SettingsService } from '../settings/settings.service';

export const MIN_VIDEO_PROGRESS_PERCENT = 95;
export const GRACE_DAYS_AFTER_EXPIRATION = 90;

// Prefix del bucket para todos los archivos del módulo chat.
// Cada módulo que suba archivos debería usar su propio prefix (ej. "avatars/", "courses/")
// para no mezclar contenidos en la raíz del bucket.
const CHAT_STORAGE_PREFIX = 'chats';

type RoomWithRelations = Prisma.ChatRoomGetPayload<{
  include: {
    user: { select: { id: true; firstName: true; lastName: true; email: true } };
    category: { select: { id: true; name: true; slug: true; image: true } };
  };
}>;

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly settings: SettingsService,
  ) {}

  /** Días de vida del chat, configurable desde el panel admin (chat.lifetimeDays). */
  async getLifetimeDays(): Promise<number> {
    return this.settings.getChatLifetimeDays();
  }

  /** Fecha de vencimiento del chat = base + días de vida configurados. */
  private async computeExpiry(from: Date): Promise<Date> {
    const days = await this.getLifetimeDays();
    const end = new Date(from);
    end.setDate(end.getDate() + days);
    return end;
  }

  // --------------------------------------------------------------------------
  // Elegibilidad y transiciones de estado
  // --------------------------------------------------------------------------

  /**
   * Devuelve el estado que debería tener la sala según la compra y el progreso.
   */
  async computeStatus(
    userId: string,
    categoryId: string,
  ): Promise<{
    status: ChatRoomStatus;
    gracePeriodEnd: Date | null;
    progressPercent: number;
    videosTotal: number;
    videosCompleted: number;
    purchaseActive: boolean;
    quizRequired: boolean;
    quizPassed: boolean;
    mentorshipRequired: boolean;
    mentorshipCompleted: boolean;
  }> {
    const now = new Date();
    const purchase = await this.prisma.categoryPurchase.findUnique({
      where: { userId_categoryId: { userId, categoryId } },
    });
    const category = await this.prisma.videoCategory.findUnique({
      where: { id: categoryId },
      select: { slug: true },
    });
    const quizRequired = category
      ? isQuizRequiredForSlug(category.slug)
      : false;
    const quizPassed = quizRequired
      ? (await this.prisma.quizAttempt.findFirst({
          where: { userId, categoryId, passed: true },
          select: { id: true },
        })) !== null
      : false;
    const videos = await this.prisma.video.findMany({
      where: { categoryId, isPublished: true, deletedAt: null },
      select: { id: true },
    });
    const videoIds = videos.map((v) => v.id);
    const views = videoIds.length
      ? await this.prisma.videoView.findMany({
          where: { userId, videoId: { in: videoIds } },
          select: { videoId: true, progress: true },
        })
      : [];
    const viewsByVideo = new Map(views.map((v) => [v.videoId, v.progress]));
    const videosCompleted = videoIds.filter(
      (id) => (viewsByVideo.get(id) ?? 0) >= MIN_VIDEO_PROGRESS_PERCENT,
    ).length;
    const videosTotal = videoIds.length;
    const progressPercent = videosTotal
      ? Math.round((videosCompleted / videosTotal) * 100)
      : 0;

    // Mentoría cumplida (COMPLETED) para este curso: requisito para abrir el chat.
    const mentorshipCompleted =
      (await this.prisma.mentorship.findFirst({
        where: { userId, categoryId, status: 'COMPLETED' },
        select: { id: true },
      })) !== null;

    // Sin compra → no debería ni existir la sala
    if (!purchase) {
      return {
        status: ChatRoomStatus.LOCKED,
        gracePeriodEnd: null,
        progressPercent,
        videosTotal,
        videosCompleted,
        purchaseActive: false,
        quizRequired,
        quizPassed,
        mentorshipRequired: true,
        mentorshipCompleted,
      };
    }

    // Gate de apertura: 95% de progreso + examen aprobado (si aplica) + haber
    // tenido la mentoría del curso. El vencimiento por vida del chat (30 días)
    // lo resuelve ensureRoom con la fecha real de desbloqueo (unlockedAt).
    const gateMet =
      videosTotal > 0 &&
      videosCompleted === videosTotal &&
      (!quizRequired || quizPassed) &&
      mentorshipCompleted;
    return {
      status: gateMet ? ChatRoomStatus.ACTIVE : ChatRoomStatus.LOCKED,
      gracePeriodEnd: null,
      progressPercent,
      videosTotal,
      videosCompleted,
      purchaseActive: purchase.isActive,
      quizRequired,
      quizPassed,
      mentorshipRequired: true,
      mentorshipCompleted,
    };
  }

  /**
   * Aplica la vida del chat sobre el gate. Recibe la sala y el resultado del
   * gate (computeStatus) y decide el estado final:
   *  - Nunca desbloqueada + gate no cumplido → LOCKED (sin expiración).
   *  - Se cumple el gate por primera vez → se desbloquea: unlockedAt=now y
   *    expiresAt=now+vida → ACTIVE.
   *  - Ya desbloqueada → la vida manda: ACTIVE si now < expiresAt, sino CLOSED.
   *    (Una vez abierta, bajar el progreso no la vuelve a LOCKEAR.)
   * Devuelve los campos a persistir.
   */
  private async resolveLifecycle(
    room: { unlockedAt: Date | null; expiresAt: Date | null },
    gateStatus: ChatRoomStatus,
    now: Date,
  ): Promise<{
    status: ChatRoomStatus;
    unlockedAt: Date | null;
    expiresAt: Date | null;
  }> {
    // Ya estuvo abierta alguna vez.
    if (room.unlockedAt) {
      // Backfill de salas viejas sin expiresAt: la calculo desde unlockedAt.
      const expiresAt =
        room.expiresAt ?? (await this.computeExpiry(room.unlockedAt));
      const status =
        now < expiresAt ? ChatRoomStatus.ACTIVE : ChatRoomStatus.CLOSED;
      return { status, unlockedAt: room.unlockedAt, expiresAt };
    }
    // Nunca se abrió: se abre solo si el gate está cumplido.
    if (gateStatus === ChatRoomStatus.ACTIVE) {
      return {
        status: ChatRoomStatus.ACTIVE,
        unlockedAt: now,
        expiresAt: await this.computeExpiry(now),
      };
    }
    return { status: ChatRoomStatus.LOCKED, unlockedAt: null, expiresAt: null };
  }

  /**
   * Asegura que exista una ChatRoom para (userId, categoryId) y actualiza su status
   * según la situación actual. Se ejecuta cada vez que se accede desde el front.
   */
  async ensureRoom(userId: string, categoryId: string): Promise<RoomWithRelations> {
    const computed = await this.computeStatus(userId, categoryId);
    const now = new Date();

    const existing = await this.prisma.chatRoom.findUnique({
      where: { userId_categoryId: { userId, categoryId } },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        category: { select: { id: true, name: true, slug: true, image: true } },
      },
    });

    if (!existing) {
      const life = await this.resolveLifecycle(
        { unlockedAt: null, expiresAt: null },
        computed.status,
        now,
      );
      return this.prisma.chatRoom.create({
        data: {
          userId,
          categoryId,
          status: life.status,
          unlockedAt: life.unlockedAt,
          expiresAt: life.expiresAt,
        },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
          category: { select: { id: true, name: true, slug: true, image: true } },
        },
      });
    }

    const life = await this.resolveLifecycle(existing, computed.status, now);

    // Transiciones: solo actualizo si cambió algo.
    const needsUpdate =
      existing.status !== life.status ||
      (existing.unlockedAt?.getTime() ?? null) !==
        (life.unlockedAt?.getTime() ?? null) ||
      (existing.expiresAt?.getTime() ?? null) !==
        (life.expiresAt?.getTime() ?? null);

    if (!needsUpdate) return existing;

    return this.prisma.chatRoom.update({
      where: { id: existing.id },
      data: {
        status: life.status,
        unlockedAt: life.unlockedAt,
        expiresAt: life.expiresAt,
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        category: { select: { id: true, name: true, slug: true, image: true } },
      },
    });
  }

  // --------------------------------------------------------------------------
  // Acceso / autorización
  // --------------------------------------------------------------------------

  isAdminRole(role: UserRole): boolean {
    return role === UserRole.ADMIN || role === UserRole.SUBADMIN;
  }

  /**
   * Verifica que el usuario tiene acceso a la sala. Devuelve la sala si todo ok.
   */
  async assertAccess(
    roomId: string,
    userId: string,
    role: UserRole,
  ): Promise<RoomWithRelations> {
    const room = await this.prisma.chatRoom.findUnique({
      where: { id: roomId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        category: { select: { id: true, name: true, slug: true, image: true } },
      },
    });
    if (!room) throw new NotFoundException('Sala no encontrada');
    if (!this.isAdminRole(role) && room.userId !== userId) {
      throw new ForbiddenException('No tenés acceso a esta sala');
    }
    return room;
  }

  canWrite(room: RoomWithRelations, role: UserRole): boolean {
    // El admin siempre puede escribir (para no quedar colgado en ningún estado).
    if (this.isAdminRole(role)) return true;
    if (room.status === ChatRoomStatus.CLOSED) return false;
    if (room.status === ChatRoomStatus.LOCKED) return false;
    // ACTIVE: el bloqueo manual del admin frena al alumno.
    if (room.blocked) return false;
    return true;
  }

  private writeBlockedMessage(room: RoomWithRelations): string {
    if (room.status === ChatRoomStatus.CLOSED) {
      return 'Esta conversación está cerrada (solo lectura).';
    }
    if (room.blocked) {
      return 'El chat fue bloqueado. Ya no podés enviar mensajes nuevos en esta conversación.';
    }
    return 'Todavía no desbloqueaste el chat. Completá los videos del curso.';
  }

  // --------------------------------------------------------------------------
  // Listados para alumno
  // --------------------------------------------------------------------------

  async listStudentRooms(userId: string) {
    // Todas las categorías que el alumno compró (activas y con gracia) → garantizamos sala
    const purchases = await this.prisma.categoryPurchase.findMany({
      where: { userId },
      select: { categoryId: true },
    });

    const rooms = await Promise.all(
      purchases.map((p) => this.ensureRoom(userId, p.categoryId)),
    );

    const unreadCounts = await this.getUnreadCountsForRooms(
      rooms.map((r) => r.id),
      userId,
      UserRole.USER,
    );

    return rooms
      .filter((r) => r.status !== ChatRoomStatus.CLOSED || r.lastMessageAt) // CLOSED vacías se ocultan
      .map((r) => ({
        ...this.serializeRoom(r),
        unread: unreadCounts.get(r.id) ?? 0,
      }));
  }

  async getStudentUnreadTotal(userId: string): Promise<number> {
    const rooms = await this.prisma.chatRoom.findMany({
      where: { userId },
      select: { id: true, lastStudentReadAt: true },
    });
    if (rooms.length === 0) return 0;
    let total = 0;
    for (const r of rooms) {
      const count = await this.prisma.chatMessage.count({
        where: {
          roomId: r.id,
          senderRole: ChatSenderRole.ADMIN,
          ...(r.lastStudentReadAt
            ? { createdAt: { gt: r.lastStudentReadAt } }
            : {}),
          readAt: null,
        },
      });
      total += count;
    }
    return total;
  }

  // --------------------------------------------------------------------------
  // Listados para admin
  // --------------------------------------------------------------------------

  async listAdminRooms(filter: {
    categoryId?: string;
    status?: ChatRoomStatus;
    search?: string;
  }) {
    const where: Prisma.ChatRoomWhereInput = {
      ...(filter.categoryId ? { categoryId: filter.categoryId } : {}),
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.search
        ? {
            user: {
              OR: [
                { firstName: { contains: filter.search, mode: 'insensitive' } },
                { lastName: { contains: filter.search, mode: 'insensitive' } },
                { email: { contains: filter.search, mode: 'insensitive' } },
              ],
            },
          }
        : {}),
      // Admin solo ve salas que tienen actividad (al menos 1 mensaje)
      lastMessageAt: { not: null },
    };

    const rooms = await this.prisma.chatRoom.findMany({
      where,
      orderBy: [{ lastMessageAt: 'desc' }],
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        category: { select: { id: true, name: true, slug: true, image: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            content: true,
            type: true,
            senderRole: true,
            createdAt: true,
          },
        },
      },
    });

    const unreadCounts = await this.getUnreadCountsForRooms(
      rooms.map((r) => r.id),
      '',
      UserRole.ADMIN,
    );

    return rooms.map((r) => ({
      ...this.serializeRoom(r),
      lastMessage: r.messages[0] ?? null,
      unread: unreadCounts.get(r.id) ?? 0,
    }));
  }

  async getAdminUnreadTotal(): Promise<number> {
    const rooms = await this.prisma.chatRoom.findMany({
      select: { id: true, lastAdminReadAt: true },
    });
    if (rooms.length === 0) return 0;
    let total = 0;
    for (const r of rooms) {
      const count = await this.prisma.chatMessage.count({
        where: {
          roomId: r.id,
          senderRole: ChatSenderRole.STUDENT,
          ...(r.lastAdminReadAt
            ? { createdAt: { gt: r.lastAdminReadAt } }
            : {}),
          readAt: null,
        },
      });
      total += count;
    }
    return total;
  }

  // --------------------------------------------------------------------------
  // Mensajes
  // --------------------------------------------------------------------------

  async listMessages(
    roomId: string,
    userId: string,
    role: UserRole,
    opts: { cursor?: string; limit?: number } = {},
  ) {
    await this.assertAccess(roomId, userId, role);
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
    const messages = await this.prisma.chatMessage.findMany({
      where: { roomId },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(opts.cursor
        ? { cursor: { id: opts.cursor }, skip: 1 }
        : {}),
      include: {
        sender: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
    const hasMore = messages.length > limit;
    const page = hasMore ? messages.slice(0, limit) : messages;
    return {
      items: page.reverse(), // devolvemos ascendente para que el front concatene abajo
      nextCursor: hasMore ? page[0].id : null,
    };
  }

  async sendMessage(params: {
    roomId: string;
    senderId: string;
    senderRole: UserRole;
    content?: string;
    imageUrl?: string;
    imageKey?: string;
  }) {
    const { roomId, senderId, senderRole, content, imageUrl, imageKey } = params;
    const hasText = !!(content && content.trim().length > 0);
    const hasImage = !!imageUrl;
    if (!hasText && !hasImage) {
      throw new BadRequestException('El mensaje no puede estar vacío');
    }

    const room = await this.assertAccess(roomId, senderId, senderRole);
    if (!this.canWrite(room, senderRole)) {
      throw new ForbiddenException(this.writeBlockedMessage(room));
    }

    const type: ChatMessageType = hasImage && !hasText ? ChatMessageType.IMAGE : ChatMessageType.TEXT;
    const role: ChatSenderRole = this.isAdminRole(senderRole)
      ? ChatSenderRole.ADMIN
      : ChatSenderRole.STUDENT;

    const message = await this.prisma.chatMessage.create({
      data: {
        roomId,
        senderId,
        senderRole: role,
        type,
        content: hasText ? content!.trim() : null,
        imageUrl: hasImage ? imageUrl! : null,
        imageKey: hasImage ? imageKey ?? null : null,
      },
      include: {
        sender: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    // Actualizo meta de la sala. Si el alumno acaba de escribir por primera vez → flag.
    const firstStudentMessage =
      role === ChatSenderRole.STUDENT && !room.studentInitiated;

    await this.prisma.chatRoom.update({
      where: { id: roomId },
      data: {
        lastMessageAt: message.createdAt,
        ...(role === ChatSenderRole.STUDENT
          ? { lastStudentReadAt: message.createdAt }
          : { lastAdminReadAt: message.createdAt }),
        ...(firstStudentMessage ? { studentInitiated: true } : {}),
      },
    });

    return { message, firstStudentMessage, room };
  }

  async markRead(roomId: string, userId: string, role: UserRole) {
    const room = await this.assertAccess(roomId, userId, role);
    const now = new Date();
    const counterpart =
      this.isAdminRole(role) ? ChatSenderRole.STUDENT : ChatSenderRole.ADMIN;

    const { count } = await this.prisma.chatMessage.updateMany({
      where: { roomId, senderRole: counterpart, readAt: null },
      data: { readAt: now },
    });

    await this.prisma.chatRoom.update({
      where: { id: roomId },
      data: this.isAdminRole(role)
        ? { lastAdminReadAt: now }
        : { lastStudentReadAt: now },
    });

    return { count, room };
  }

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  async getUnreadCountsForRooms(
    roomIds: string[],
    userId: string,
    role: UserRole,
  ): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    if (roomIds.length === 0) return result;

    const rooms = await this.prisma.chatRoom.findMany({
      where: { id: { in: roomIds } },
      select: {
        id: true,
        userId: true,
        lastStudentReadAt: true,
        lastAdminReadAt: true,
      },
    });

    for (const room of rooms) {
      const isAdmin = this.isAdminRole(role);
      if (!isAdmin && room.userId !== userId) {
        result.set(room.id, 0);
        continue;
      }
      const since = isAdmin ? room.lastAdminReadAt : room.lastStudentReadAt;
      const counterpart = isAdmin ? ChatSenderRole.STUDENT : ChatSenderRole.ADMIN;
      const count = await this.prisma.chatMessage.count({
        where: {
          roomId: room.id,
          senderRole: counterpart,
          readAt: null,
          ...(since ? { createdAt: { gt: since } } : {}),
        },
      });
      result.set(room.id, count);
    }
    return result;
  }

  private serializeRoom(r: RoomWithRelations) {
    return {
      id: r.id,
      status: r.status,
      unlockedAt: r.unlockedAt,
      expiresAt: r.expiresAt,
      lastMessageAt: r.lastMessageAt,
      studentInitiated: r.studentInitiated,
      blocked: r.blocked,
      blockedAt: r.blockedAt,
      category: r.category,
      user: r.user,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  serializeRoomAsync(r: RoomWithRelations) {
    return this.serializeRoom(r);
  }

  // --------------------------------------------------------------------------
  // Bloqueo manual + vida del chat (acciones del admin)
  // --------------------------------------------------------------------------

  private async updateRoomReturning(
    roomId: string,
    data: Prisma.ChatRoomUpdateInput,
  ): Promise<RoomWithRelations> {
    return this.prisma.chatRoom.update({
      where: { id: roomId },
      data,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        category: { select: { id: true, name: true, slug: true, image: true } },
      },
    });
  }

  /** Bloquea (o desbloquea) el chat: el alumno deja de poder escribir. */
  async setBlocked(params: {
    roomId: string;
    adminId: string;
    adminRole: UserRole;
    blocked: boolean;
  }) {
    const { roomId, adminId, adminRole, blocked } = params;
    if (!this.isAdminRole(adminRole)) {
      throw new ForbiddenException('Solo un administrador puede bloquear el chat');
    }
    const room = await this.assertAccess(roomId, adminId, adminRole);
    if (room.blocked === blocked) {
      return { room: this.serializeRoom(room), changed: false };
    }
    const updated = await this.updateRoomReturning(roomId, {
      blocked,
      blockedAt: blocked ? new Date() : null,
    });
    return { room: this.serializeRoom(updated), changed: true };
  }

  /**
   * Extiende (o reabre) la vida del chat. Empuja expiresAt a now + días y, si
   * estaba cerrado, lo vuelve a ACTIVE. Si nunca se desbloqueó, lo desbloquea.
   */
  async extendRoom(params: {
    roomId: string;
    adminId: string;
    adminRole: UserRole;
    days?: number;
  }) {
    const { roomId, adminId, adminRole, days } = params;
    if (!this.isAdminRole(adminRole)) {
      throw new ForbiddenException('Solo un administrador puede extender el chat');
    }
    const room = await this.assertAccess(roomId, adminId, adminRole);
    const now = new Date();
    const span = days && days > 0 ? days : await this.getLifetimeDays();
    // Extiende desde el vencimiento futuro si aún no venció; si ya venció, desde hoy.
    const base = room.expiresAt && room.expiresAt > now ? room.expiresAt : now;
    const expiresAt = new Date(base);
    expiresAt.setDate(expiresAt.getDate() + span);

    const updated = await this.updateRoomReturning(roomId, {
      expiresAt,
      unlockedAt: room.unlockedAt ?? now,
      status: ChatRoomStatus.ACTIVE,
    });
    return { room: this.serializeRoom(updated), changed: true };
  }

  /**
   * Reabre/extiende todas las salas ya desbloqueadas de un usuario. Se llama
   * cuando el alumno compra otra formación: renueva la vida del chat a
   * now + días de vida y lo vuelve ACTIVE (respeta el bloqueo manual).
   */
  async reopenRoomsForUser(userId: string): Promise<{ reopened: number }> {
    const now = new Date();
    const expiresAt = await this.computeExpiry(now);
    const { count } = await this.prisma.chatRoom.updateMany({
      where: { userId, unlockedAt: { not: null } },
      data: { expiresAt, status: ChatRoomStatus.ACTIVE },
    });
    return { reopened: count };
  }

  // --------------------------------------------------------------------------
  // Mantenimiento (usado por cron)
  // --------------------------------------------------------------------------

  async recomputeAllRoomStatuses(): Promise<{ updated: number }> {
    const rooms = await this.prisma.chatRoom.findMany({
      select: { id: true, userId: true, categoryId: true, status: true },
    });
    let updated = 0;
    for (const r of rooms) {
      const before = r.status;
      const after = await this.ensureRoom(r.userId, r.categoryId);
      if (after.status !== before) updated++;
    }
    return { updated };
  }

  async uploadImage(
    roomId: string,
    userId: string,
    role: UserRole,
    file: { buffer: Buffer; mimetype: string; originalname: string; size: number },
  ) {
    const room = await this.assertAccess(roomId, userId, role);
    if (!this.canWrite(room, role)) {
      throw new ForbiddenException(this.writeBlockedMessage(room));
    }
    if (!file || !file.buffer) {
      throw new BadRequestException('Archivo inválido');
    }
    if (!['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(file.mimetype)) {
      throw new BadRequestException('Formato no permitido (solo PNG/JPG/WEBP)');
    }
    if (file.size > 10 * 1024 * 1024) {
      throw new BadRequestException('Imagen demasiado grande (máximo 10 MB)');
    }
    const { url, key } = await this.storage.uploadBuffer({
      buffer: file.buffer,
      contentType: file.mimetype,
      originalName: file.originalname,
      folder: `${CHAT_STORAGE_PREFIX}/${roomId}`,
    });
    return { url, key };
  }
}
