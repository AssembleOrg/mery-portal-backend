import {
  CanActivate,
  Controller,
  ExecutionContext,
  Get,
  Injectable,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'crypto';
import type { Request } from 'express';
import { MentorshipStatus } from '@prisma/client';
import { PrismaService } from '../../shared/services';

/** Otros sistemas (bot de Costear) con secreto: header X-Integration-Secret. */
@Injectable()
export class MentorshipIntegrationGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const secret = this.config.get<string>('MENTORSHIP_FEED_SECRET', '');
    if (secret.length < 32)
      throw new UnauthorizedException('Integración no configurada');
    const provided = context.switchToHttp().getRequest<Request>().headers[
      'x-integration-secret'
    ];
    if (typeof provided !== 'string' || !provided)
      throw new UnauthorizedException();
    const a = createHash('sha256').update(provided).digest();
    const b = createHash('sha256').update(secret).digest();
    if (!timingSafeEqual(a, b)) throw new UnauthorizedException();
    return true;
  }
}

/**
 * Mentorías que vienen (para /proxima-mentoria y /mery-mentorias del bot de
 * WhatsApp de Costear). Solo lectura.
 */
@Controller('integrations/mentorships')
@UseGuards(MentorshipIntegrationGuard)
export class MentorshipIntegrationController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('upcoming')
  async upcoming(@Query('limit') limit?: string) {
    const take = Math.min(Math.max(Number(limit) || 30, 1), 100);
    const rows = await this.prisma.mentorship.findMany({
      where: {
        status: MentorshipStatus.SCHEDULED,
        scheduledEnd: { gte: new Date() },
      },
      orderBy: { scheduledStart: 'asc' },
      take,
      include: {
        user: {
          select: { firstName: true, lastName: true, email: true, phone: true },
        },
        category: { select: { name: true } },
      },
    });
    return rows.map((m) => ({
      id: m.id,
      start: m.scheduledStart.toISOString(),
      end: m.scheduledEnd.toISOString(),
      courseName: m.category.name,
      studentName:
        [m.user.firstName, m.user.lastName].filter(Boolean).join(' ').trim() ||
        m.user.email,
      studentEmail: m.user.email,
      studentPhone: m.user.phone,
      meetingEmail: m.meetingEmail,
      meetLink: m.googleMeetLink,
      paid: !!m.creditId,
      rescheduleCount: m.rescheduleCount,
      bookedAt: m.createdAt.toISOString(),
    }));
  }
}
