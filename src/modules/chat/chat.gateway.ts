import { Logger, UnauthorizedException } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { ChatEmailService } from './chat-email.service';
import type { JwtPayload } from '../../shared/types';
import { UserRole } from '../../shared/types';
import { Prisma } from '@prisma/client';

type RoomLike = { id: string; userId: string; categoryId: string };

interface AuthedSocket extends Socket {
  data: {
    userId: string;
    role: UserRole;
    email: string;
  };
}

const allowedChatOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (
        allowedChatOrigins.includes('*') ||
        allowedChatOrigins.includes(origin)
      ) {
        return cb(null, true);
      }
      return cb(new Error(`Origen no permitido por CORS: ${origin}`), false);
    },
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly chat: ChatService,
    private readonly email: ChatEmailService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  // --------------------------------------------------------------------------
  // Ciclo de vida
  // --------------------------------------------------------------------------

  async handleConnection(client: Socket) {
    const origin = client.handshake.headers.origin ?? '(sin origin)';
    try {
      const token = this.extractToken(client);
      if (!token) {
        this.logger.warn(
          `[Chat WS] handshake sin token (origin=${origin}, auth=${JSON.stringify(
            client.handshake.auth ?? {},
          )}, cookie=${client.handshake.headers.cookie ? 'sí' : 'no'})`,
        );
        throw new UnauthorizedException('Token ausente');
      }

      const secret =
        this.config.get<string>('JWT_SECRET') || 'default-secret';
      const payload = this.jwt.verify<JwtPayload>(token, { secret });

      (client as AuthedSocket).data = {
        userId: payload.sub,
        role: payload.role,
        email: payload.email,
      };

      // Sala privada por usuario: notificaciones globales (badge)
      await client.join(`user:${payload.sub}`);
      if (payload.role === UserRole.ADMIN || payload.role === UserRole.SUBADMIN) {
        await client.join('admins');
      }

      this.logger.log(
        `[Chat WS] ✅ connect ${payload.email} (${payload.role}) origin=${origin}`,
      );
    } catch (err) {
      this.logger.warn(
        `[Chat WS] ❌ rechazado origin=${origin}: ${
          (err as Error).message ?? 'desconocido'
        }`,
      );
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    const data = (client as AuthedSocket).data;
    if (data?.email) this.logger.debug(`WS disconnect ${data.email}`);
  }

  // --------------------------------------------------------------------------
  // Handlers
  // --------------------------------------------------------------------------

  @SubscribeMessage('join_room')
  async onJoinRoom(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { roomId: string },
  ) {
    if (!body?.roomId) return { ok: false, error: 'roomId requerido' };
    try {
      await this.chat.assertAccess(body.roomId, client.data.userId, client.data.role);
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
    await client.join(`room:${body.roomId}`);
    return { ok: true };
  }

  @SubscribeMessage('leave_room')
  async onLeaveRoom(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { roomId: string },
  ) {
    if (!body?.roomId) return { ok: false };
    await client.leave(`room:${body.roomId}`);
    return { ok: true };
  }

  @SubscribeMessage('send_message')
  async onSendMessage(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody()
    body: { roomId: string; content?: string; imageUrl?: string; imageKey?: string },
  ) {
    if (!body?.roomId) return { ok: false, error: 'roomId requerido' };
    try {
      const { message, firstStudentMessage, room } = await this.chat.sendMessage({
        roomId: body.roomId,
        senderId: client.data.userId,
        senderRole: client.data.role,
        content: body.content,
        imageUrl: body.imageUrl,
        imageKey: body.imageKey,
      });
      this.broadcastNewMessage(message, room);
      if (firstStudentMessage) {
        this.email
          .notifyAdminsOfNewConversation(room)
          .catch((err) =>
            this.logger.error('Email first-conversation failed', err),
          );
      }
      return { ok: true, message };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }

  @SubscribeMessage('typing')
  onTyping(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { roomId: string; typing: boolean },
  ) {
    if (!body?.roomId) return;
    client.to(`room:${body.roomId}`).emit('typing', {
      roomId: body.roomId,
      userId: client.data.userId,
      role: client.data.role,
      typing: !!body.typing,
    });
  }

  @SubscribeMessage('mark_read')
  async onMarkRead(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { roomId: string },
  ) {
    if (!body?.roomId) return { ok: false };
    try {
      await this.chat.markRead(body.roomId, client.data.userId, client.data.role);
      this.broadcastRead(body.roomId, client.data.role);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }

  // --------------------------------------------------------------------------
  // Broadcasters (usados también desde el controller REST)
  // --------------------------------------------------------------------------

  broadcastNewMessage(
    message: Prisma.ChatMessageGetPayload<{
      include: {
        sender: { select: { id: true; firstName: true; lastName: true; email: true } };
      };
    }>,
    room: RoomLike,
  ) {
    if (!this.server) return;
    this.server.to(`room:${room.id}`).emit('message', message);
    // También disparo un evento a los "canales" de notificaciones (badge)
    this.server.to(`user:${room.userId}`).emit('unread_changed', {
      roomId: room.id,
    });
    this.server.to('admins').emit('unread_changed', { roomId: room.id });
  }

  broadcastRead(roomId: string, readerRole: UserRole) {
    if (!this.server) return;
    this.server.to(`room:${roomId}`).emit('read_receipt', {
      roomId,
      readerRole,
      readAt: new Date().toISOString(),
    });
  }

  broadcastRoomStatusChanged(roomId: string, status: string) {
    if (!this.server) return;
    this.server.to(`room:${roomId}`).emit('room_status_changed', { roomId, status });
  }

  // --------------------------------------------------------------------------
  // Utils
  // --------------------------------------------------------------------------

  private extractToken(client: Socket): string | null {
    const auth = (client.handshake?.auth ?? {}) as Record<string, unknown>;
    const fromAuth = typeof auth.token === 'string' ? auth.token : null;
    if (fromAuth) return fromAuth;
    const header = client.handshake?.headers?.authorization;
    if (header && header.startsWith('Bearer ')) return header.slice(7);
    const query = client.handshake?.query?.token;
    if (typeof query === 'string') return query;
    const cookie = client.handshake?.headers?.cookie;
    if (cookie) {
      const match = cookie.match(/auth_token=([^;]+)/);
      if (match) return decodeURIComponent(match[1]);
    }
    return null;
  }
}
