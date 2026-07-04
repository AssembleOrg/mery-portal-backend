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
  ) {}

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
      };
    }

    // Compra con fecha de expiración ya cumplida → GRACE o CLOSED
    if (purchase.expiresAt && purchase.expiresAt < now) {
      const graceEnd = new Date(purchase.expiresAt);
      graceEnd.setDate(graceEnd.getDate() + GRACE_DAYS_AFTER_EXPIRATION);
      const status =
        now < graceEnd ? ChatRoomStatus.GRACE : ChatRoomStatus.CLOSED;
      return {
        status,
        gracePeriodEnd: graceEnd,
        progressPercent,
        videosTotal,
        videosCompleted,
        purchaseActive: purchase.isActive,
        quizRequired,
        quizPassed,
      };
    }

    // Compra activa + 95% progreso en todos los videos + examen aprobado
    // (si la categoría lo exige) → ACTIVE, sino LOCKED
    const unlocked =
      videosTotal > 0 &&
      videosCompleted === videosTotal &&
      (!quizRequired || quizPassed);
    return {
      status: unlocked ? ChatRoomStatus.ACTIVE : ChatRoomStatus.LOCKED,
      gracePeriodEnd: null,
      progressPercent,
      videosTotal,
      videosCompleted,
      purchaseActive: purchase.isActive,
      quizRequired,
      quizPassed,
    };
  }

  /**
   * Asegura que exista una ChatRoom para (userId, categoryId) y actualiza su status
   * según la situación actual. Se ejecuta cada vez que se accede desde el front.
   */
  async ensureRoom(userId: string, categoryId: string): Promise<RoomWithRelations> {
    const computed = await this.computeStatus(userId, categoryId);

    const existing = await this.prisma.chatRoom.findUnique({
      where: { userId_categoryId: { userId, categoryId } },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        category: { select: { id: true, name: true, slug: true, image: true } },
      },
    });

    if (!existing) {
      const created = await this.prisma.chatRoom.create({
        data: {
          userId,
          categoryId,
          status: computed.status,
          unlockedAt: computed.status === ChatRoomStatus.ACTIVE ? new Date() : null,
          gracePeriodEnd: computed.gracePeriodEnd,
        },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
          category: { select: { id: true, name: true, slug: true, image: true } },
        },
      });
      return created;
    }

    // Transiciones: solo actualizo si cambió
    const needsUpdate =
      existing.status !== computed.status ||
      (existing.gracePeriodEnd?.getTime() ?? null) !==
        (computed.gracePeriodEnd?.getTime() ?? null);

    if (!needsUpdate) return existing;

    const updated = await this.prisma.chatRoom.update({
      where: { id: existing.id },
      data: {
        status: computed.status,
        gracePeriodEnd: computed.gracePeriodEnd,
        unlockedAt:
          existing.unlockedAt === null && computed.status === ChatRoomStatus.ACTIVE
            ? new Date()
            : existing.unlockedAt,
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        category: { select: { id: true, name: true, slug: true, image: true } },
      },
    });
    return updated;
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
    if (room.status === ChatRoomStatus.CLOSED) return false;
    if (room.status === ChatRoomStatus.LOCKED) {
      // El alumno no puede escribir en LOCKED. Admin sí, para no quedar colgado.
      return this.isAdminRole(role);
    }
    return true; // ACTIVE y GRACE
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
      throw new ForbiddenException(
        room.status === ChatRoomStatus.CLOSED
          ? 'Esta conversación está cerrada (solo lectura).'
          : 'Todavía no desbloqueaste el chat. Completá los videos del curso.',
      );
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
      gracePeriodEnd: r.gracePeriodEnd,
      lastMessageAt: r.lastMessageAt,
      studentInitiated: r.studentInitiated,
      category: r.category,
      user: r.user,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
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
      throw new ForbiddenException('No podés adjuntar imágenes en esta sala');
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
