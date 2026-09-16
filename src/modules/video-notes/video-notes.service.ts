import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/services';
import { UserRole } from '../../shared/types';
import { CreateVideoNoteDto, UpdateVideoNoteDto } from './dto';

const noteSelect = {
  id: true,
  videoId: true,
  categoryId: true,
  timeSeconds: true,
  content: true,
  createdAt: true,
  updatedAt: true,
  video: { select: { id: true, title: true, order: true, duration: true } },
} as const;

/**
 * Diario de anotaciones por video: cada nota apunta a un segundo del video
 * para que la alumna pueda volver a ese momento al consultar una duda.
 * Solo escribe la dueña; el admin lee todo.
 */
@Injectable()
export class VideoNotesService {
  constructor(private readonly prisma: PrismaService) {}

  private isStaff(role: UserRole) {
    return role === UserRole.ADMIN || role === UserRole.SUBADMIN;
  }

  private async assertPurchase(userId: string, categoryId: string, role: UserRole) {
    if (this.isStaff(role)) return;
    const purchase = await this.prisma.categoryPurchase.findUnique({
      where: { userId_categoryId: { userId, categoryId } },
      select: { isActive: true, expiresAt: true },
    });
    const expired = purchase?.expiresAt && purchase.expiresAt.getTime() < Date.now();
    if (!purchase || !purchase.isActive || expired) {
      throw new ForbiddenException('No tenés acceso a este curso');
    }
  }

  private async findVideoOrFail(videoId: string) {
    const video = await this.prisma.video.findFirst({
      where: { id: videoId, deletedAt: null },
      select: { id: true, categoryId: true, duration: true },
    });
    if (!video) throw new NotFoundException('Video no encontrado');
    return video;
  }

  /** Notas mías de un video, en orden de aparición. */
  async listMineByVideo(userId: string, role: UserRole, videoId: string) {
    const video = await this.findVideoOrFail(videoId);
    await this.assertPurchase(userId, video.categoryId, role);
    return this.prisma.videoNote.findMany({
      where: { userId, videoId },
      orderBy: [{ timeSeconds: 'asc' }, { createdAt: 'asc' }],
      select: noteSelect,
    });
  }

  /** Diario completo de una formación (todas mis notas, agrupables por video). */
  async listMineByCategory(userId: string, role: UserRole, categoryId: string) {
    await this.assertPurchase(userId, categoryId, role);
    return this.prisma.videoNote.findMany({
      where: { userId, categoryId },
      orderBy: [{ video: { order: 'asc' } }, { timeSeconds: 'asc' }, { createdAt: 'asc' }],
      select: noteSelect,
    });
  }

  async create(userId: string, role: UserRole, dto: CreateVideoNoteDto) {
    const video = await this.findVideoOrFail(dto.videoId);
    await this.assertPurchase(userId, video.categoryId, role);
    const timeSeconds = this.clampTime(dto.timeSeconds, video.duration);
    return this.prisma.videoNote.create({
      data: {
        userId,
        videoId: video.id,
        categoryId: video.categoryId,
        timeSeconds,
        content: dto.content.trim(),
      },
      select: noteSelect,
    });
  }

  async update(userId: string, noteId: string, dto: UpdateVideoNoteDto) {
    const note = await this.findOwnNoteOrFail(userId, noteId);
    const data: { timeSeconds?: number; content?: string } = {};
    if (dto.timeSeconds !== undefined) {
      data.timeSeconds = this.clampTime(dto.timeSeconds, note.video.duration);
    }
    if (dto.content !== undefined) data.content = dto.content.trim();
    return this.prisma.videoNote.update({
      where: { id: noteId },
      data,
      select: noteSelect,
    });
  }

  async remove(userId: string, noteId: string) {
    await this.findOwnNoteOrFail(userId, noteId);
    await this.prisma.videoNote.delete({ where: { id: noteId } });
    return { deleted: true };
  }

  // ─── Admin ────────────────────────────────────────────────────────

  /** Todas las notas de una alumna, con video y formación; opcionalmente de una sola formación. */
  async adminListByUser(userId: string, categoryId?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, firstName: true, lastName: true, email: true },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    const notes = await this.prisma.videoNote.findMany({
      where: { userId, ...(categoryId ? { categoryId } : {}) },
      orderBy: [
        { category: { name: 'asc' } },
        { video: { order: 'asc' } },
        { timeSeconds: 'asc' },
      ],
      select: {
        ...noteSelect,
        category: { select: { id: true, name: true, slug: true } },
      },
    });
    return { user, notes };
  }

  /** Resumen por alumna: cuántas notas y cuándo fue la última (para el listado del admin). */
  async adminSummary() {
    const grouped = await this.prisma.videoNote.groupBy({
      by: ['userId'],
      _count: { _all: true },
      _max: { createdAt: true },
      orderBy: { _max: { createdAt: 'desc' } },
      take: 200,
    });
    if (grouped.length === 0) return [];
    const users = await this.prisma.user.findMany({
      where: { id: { in: grouped.map((g) => g.userId) } },
      select: { id: true, firstName: true, lastName: true, email: true },
    });
    const byId = new Map(users.map((u) => [u.id, u]));
    return grouped
      .map((g) => ({
        user: byId.get(g.userId),
        count: g._count._all,
        lastNoteAt: g._max.createdAt,
      }))
      .filter((r) => r.user);
  }

  // ─── Helpers ──────────────────────────────────────────────────────

  private async findOwnNoteOrFail(userId: string, noteId: string) {
    const note = await this.prisma.videoNote.findUnique({
      where: { id: noteId },
      select: { id: true, userId: true, video: { select: { duration: true } } },
    });
    if (!note) throw new NotFoundException('Nota no encontrada');
    if (note.userId !== userId) throw new ForbiddenException('Esta nota no es tuya');
    return note;
  }

  private clampTime(seconds: number, duration: number | null) {
    const t = Math.max(0, Math.floor(seconds));
    return duration && duration > 0 ? Math.min(t, duration) : t;
  }
}
