import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as SibApiV3Sdk from '@sendinblue/client';
import { PrismaService } from '../../shared/services';
import { UserRole } from '../../shared/types';

type RoomWithUserAndCategory = {
  id: string;
  userId: string;
  user: {
    firstName: string | null;
    lastName: string | null;
    email: string;
  };
  category: { id: string; name: string };
};

@Injectable()
export class ChatEmailService {
  private readonly logger = new Logger(ChatEmailService.name);
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

  async notifyAdminsOfNewConversation(room: RoomWithUserAndCategory): Promise<void> {
    const admins = await this.prisma.user.findMany({
      where: {
        role: { in: [UserRole.ADMIN, UserRole.SUBADMIN] },
        isActive: true,
        deletedAt: null,
      },
      select: { email: true, firstName: true },
    });
    if (admins.length === 0) return;

    const studentName =
      [room.user.firstName, room.user.lastName].filter(Boolean).join(' ').trim() ||
      room.user.email;
    const frontendUrl = this.config.get<string>('FRONTEND_URL', '');
    const chatUrl = `${frontendUrl}/es/admin/chats?roomId=${room.id}`;

    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
    sendSmtpEmail.sender = {
      name: 'Mery Garcia - Cosmetic Tattoo',
      email: this.config.get<string>('EMAIL_FROM', 'noreply@merygarcia.com'),
    };
    sendSmtpEmail.to = admins.map((a) => ({
      email: a.email,
      name: a.firstName ?? 'Admin',
    }));
    sendSmtpEmail.subject = `Nueva conversación: ${studentName} — ${room.category.name}`;
    sendSmtpEmail.htmlContent = this.template({
      studentName,
      courseName: room.category.name,
      chatUrl,
    });

    try {
      await this.api.sendTransacEmail(sendSmtpEmail);
      this.logger.log(`Email de nueva conversación enviado a ${admins.length} admin(s)`);
    } catch (err) {
      this.logger.error('No se pudo enviar email de nueva conversación', err as Error);
    }
  }

  private template({
    studentName,
    courseName,
    chatUrl,
  }: {
    studentName: string;
    courseName: string;
    chatUrl: string;
  }): string {
    return `
<!DOCTYPE html>
<html lang="es">
  <body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f5f5f5;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center" style="padding:30px 10px;">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;">
          <tr><td style="background:#000;padding:30px;text-align:center;color:#fff;letter-spacing:6px;">MERY GARCIA</td></tr>
          <tr><td style="padding:32px;color:#333;">
            <h2 style="margin:0 0 12px;color:#000;">Nueva conversación de alumno</h2>
            <p style="color:#555;line-height:1.6;">
              <strong>${studentName}</strong> acaba de iniciar un chat en la formación
              <strong>${courseName}</strong>.
            </p>
            <div style="text-align:center;margin:32px 0;">
              <a href="${chatUrl}" style="background:#ffb6c1;color:#fff;padding:14px 32px;border-radius:25px;text-decoration:none;letter-spacing:1px;">VER CONVERSACIÓN</a>
            </div>
            <p style="color:#999;font-size:12px;line-height:1.5;">
              Este aviso se envía solo la primera vez que un alumno te escribe.
              Los siguientes mensajes los verás como notificación dentro del panel.
            </p>
          </td></tr>
          <tr><td style="background:#f9f9f9;padding:18px;text-align:center;color:#999;font-size:12px;">
            © ${new Date().getFullYear()} Mery Garcia - Cosmetic Tattoo
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
  }
}
