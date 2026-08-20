import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as SibApiV3Sdk from '@sendinblue/client';
import { PrismaService } from '../../shared/services';
import { UserRole } from '../../shared/types';

interface BookingEmailParams {
  studentName: string;
  studentEmail: string;
  courseName: string;
  start: Date;
  meetLink: string | null;
  action: 'reservó' | 'reprogramó' | 'canceló';
}

/** Avisa a los admins cuando se agenda / reprograma / cancela una mentoría. */
@Injectable()
export class MentorshipEmailService {
  private readonly logger = new Logger(MentorshipEmailService.name);
  private readonly api: SibApiV3Sdk.TransactionalEmailsApi;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.api = new SibApiV3Sdk.TransactionalEmailsApi();
    this.api.setApiKey(
      SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey,
      this.config.get<string>('BREVO_API_KEY', ''),
    );
  }

  async notifyAdmins(params: BookingEmailParams): Promise<void> {
    const admins = await this.prisma.user.findMany({
      where: {
        role: { in: [UserRole.ADMIN, UserRole.SUBADMIN] },
        isActive: true,
        deletedAt: null,
      },
      select: { email: true, firstName: true },
    });
    if (admins.length === 0) return;

    const when = params.start.toLocaleString('es-AR', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Argentina/Buenos_Aires',
    });
    const frontendUrl = this.config.get<string>('FRONTEND_URL', '');
    const adminUrl = `${frontendUrl}/es/admin/mentorias`;

    const email = new SibApiV3Sdk.SendSmtpEmail();
    email.sender = {
      name: 'Mery Garcia - Cosmetic Tattoo',
      email: this.config.get<string>('EMAIL_FROM', 'noreply@merygarcia.com'),
    };
    email.to = admins.map((a) => ({ email: a.email, name: a.firstName ?? 'Admin' }));
    email.subject = `Mentoría ${params.action}: ${params.studentName} — ${params.courseName}`;
    email.htmlContent = `
      <div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:0 auto;color:#3a1f26">
        <h2 style="color:#660e1b">Mentoría ${params.action}</h2>
        <p><strong>${params.studentName}</strong> (${params.studentEmail}) ${params.action}
        su mentoría de <strong>${params.courseName}</strong>.</p>
        <p style="text-transform:capitalize"><strong>${when} hs</strong></p>
        ${params.meetLink ? `<p><a href="${params.meetLink}">Google Meet</a></p>` : ''}
        <p style="margin-top:20px"><a href="${adminUrl}"
          style="background:#660e1b;color:#fff;text-decoration:none;padding:10px 20px;border-radius:999px;font-weight:700">
          Ver mentorías</a></p>
      </div>`;

    try {
      await this.api.sendTransacEmail(email);
      this.logger.log(`Aviso de mentoría (${params.action}) a ${admins.length} admin(s)`);
    } catch (err) {
      this.logger.error('No se pudo avisar a los admins de la mentoría', err as Error);
    }
  }
}
