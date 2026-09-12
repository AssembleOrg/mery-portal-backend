import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import * as webpush from 'web-push';
import { PrismaService } from '../../shared/services';
import { UserRole } from '../../shared/types';
import { ChatGateway } from '../chat/chat.gateway';

export interface NotifyPayload {
  type: string;
  title: string;
  body?: string | null;
  /** Ruta relativa del front a abrir al tocar (ej. /es/mi-cuenta). */
  url?: string | null;
  data?: Prisma.InputJsonValue;
}

export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

const LIST_LIMIT = 30;

/**
 * Notificaciones in-app persistentes (campana) + Web Push opcional (PWA).
 * Cada notificación se guarda, se emite por socket (sala user:{id}) y, si el
 * usuario suscribió algún dispositivo, se manda también como push.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly pushEnabled: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly gateway: ChatGateway,
  ) {
    const pub = this.config.get<string>('VAPID_PUBLIC_KEY', '');
    const priv = this.config.get<string>('VAPID_PRIVATE_KEY', '');
    const subject = this.config.get<string>('VAPID_SUBJECT', 'mailto:noreply@merygarcia.com');
    this.pushEnabled = !!pub && !!priv;
    if (this.pushEnabled) {
      webpush.setVapidDetails(subject, pub, priv);
    } else {
      this.logger.warn('Web Push deshabilitado: faltan VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY');
    }
  }

  // ---------------------------------------------------------------------------
  // Crear / enviar
  // ---------------------------------------------------------------------------

  async notify(userId: string, payload: NotifyPayload) {
    const n = await this.prisma.notification.create({
      data: {
        userId,
        type: payload.type,
        title: payload.title,
        body: payload.body ?? null,
        url: payload.url ?? null,
        data: payload.data ?? undefined,
      },
    });
    const dto = this.serialize(n);
    this.gateway.emitNotification(userId, dto);
    void this.sendPush(userId, dto).catch((err) =>
      this.logger.warn(`push falló para ${userId}: ${(err as Error).message}`),
    );
    return dto;
  }

  async notifyMany(userIds: string[], payload: NotifyPayload) {
    const unique = Array.from(new Set(userIds));
    await Promise.allSettled(unique.map((id) => this.notify(id, payload)));
  }

  /** A todos los admins/subadmins activos. */
  async notifyAdmins(payload: NotifyPayload) {
    const admins = await this.prisma.user.findMany({
      where: {
        role: { in: [UserRole.ADMIN, UserRole.SUBADMIN] },
        isActive: true,
        deletedAt: null,
      },
      select: { id: true },
    });
    await this.notifyMany(
      admins.map((a) => a.id),
      payload,
    );
  }

  private async sendPush(
    userId: string,
    n: { id: string; title: string; body: string | null; url: string | null },
  ) {
    if (!this.pushEnabled) return;
    const subs = await this.prisma.pushSubscription.findMany({ where: { userId } });
    if (subs.length === 0) return;
    const message = JSON.stringify({
      id: n.id,
      title: n.title,
      body: n.body ?? '',
      url: n.url ?? '/es/mi-cuenta',
    });
    await Promise.allSettled(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            message,
            { TTL: 60 * 60 * 24 },
          );
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode;
          // Suscripción vencida / desinstalada → se limpia.
          if (status === 404 || status === 410) {
            await this.prisma.pushSubscription
              .delete({ where: { id: s.id } })
              .catch(() => undefined);
          } else {
            throw err;
          }
        }
      }),
    );
  }

  // ---------------------------------------------------------------------------
  // Lectura
  // ---------------------------------------------------------------------------

  async list(userId: string) {
    const [rows, unread] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: LIST_LIMIT,
      }),
      this.unreadCount(userId),
    ]);
    return { items: rows.map((r) => this.serialize(r)), unread };
  }

  async unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  async markRead(userId: string, id: string) {
    const n = await this.prisma.notification.findUnique({ where: { id } });
    if (!n || n.userId !== userId) throw new NotFoundException('Notificación no encontrada');
    if (!n.readAt) {
      await this.prisma.notification.update({
        where: { id },
        data: { readAt: new Date() },
      });
    }
    return { read: true };
  }

  async markAllRead(userId: string) {
    const { count } = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { read: count };
  }

  // ---------------------------------------------------------------------------
  // Web Push (opt-in por dispositivo)
  // ---------------------------------------------------------------------------

  publicKey() {
    return {
      enabled: this.pushEnabled,
      publicKey: this.pushEnabled ? this.config.get<string>('VAPID_PUBLIC_KEY', '') : null,
    };
  }

  async subscribePush(userId: string, sub: PushSubscriptionInput, userAgent?: string) {
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: sub.endpoint },
      update: { userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent: userAgent ?? null },
      create: {
        userId,
        endpoint: sub.endpoint,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
        userAgent: userAgent ?? null,
      },
    });
    return { subscribed: true };
  }

  async unsubscribePush(userId: string, endpoint: string) {
    await this.prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
    return { unsubscribed: true };
  }

  private serialize(n: {
    id: string;
    type: string;
    title: string;
    body: string | null;
    url: string | null;
    data: Prisma.JsonValue | null;
    readAt: Date | null;
    createdAt: Date;
  }) {
    return {
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      url: n.url,
      data: n.data,
      readAt: n.readAt ? n.readAt.toISOString() : null,
      createdAt: n.createdAt.toISOString(),
    };
  }
}
