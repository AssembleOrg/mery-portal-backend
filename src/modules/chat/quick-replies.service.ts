import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/services';
import {
  CreateQuickReplyDto,
  UpdateQuickReplyDto,
} from './dto';

/**
 * CRUD de respuestas rápidas del chat admin. Son globales (compartidas por
 * todos los admins/subadmins). El admin las inserta en el input del chat de
 * un alumno para editarlas antes de enviar.
 */
@Injectable()
export class QuickRepliesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(search?: string) {
    const where: Prisma.ChatQuickReplyWhereInput = search?.trim()
      ? { title: { contains: search.trim(), mode: 'insensitive' } }
      : {};
    return this.prisma.chatQuickReply.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
    });
  }

  async create(dto: CreateQuickReplyDto) {
    return this.prisma.chatQuickReply.create({
      data: { title: dto.title.trim(), body: dto.body },
    });
  }

  async update(id: string, dto: UpdateQuickReplyDto) {
    await this.ensureExists(id);
    return this.prisma.chatQuickReply.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.body !== undefined ? { body: dto.body } : {}),
      },
    });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    await this.prisma.chatQuickReply.delete({ where: { id } });
    return { deleted: true };
  }

  private async ensureExists(id: string) {
    const found = await this.prisma.chatQuickReply.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!found) throw new NotFoundException('Respuesta rápida no encontrada');
  }
}
