import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as SibApiV3Sdk from '@sendinblue/client';
import { PrismaService } from '../../shared/services';
import { UserRole } from '../../shared/types';
import { EmailService } from '../email/email.service';

export interface BookingEmailParams {
  studentName: string;
  studentEmail: string;
  /** Email que la alumna cargó en el formulario de reserva. */
  meetingEmail: string;
  courseName: string;
  start: Date;
  meetLink: string | null;
  action: 'reservó' | 'reprogramó' | 'canceló';
}

interface LayoutOptions {
  eyebrow: string;
  title: string;
  /** HTML ya escapado. */
  intro: string;
  rows: [label: string, value: string][];
  cta?: { label: string; url: string };
  /** HTML ya escapado. */
  note?: string;
  link?: { label: string; url: string };
  footer: string;
}

const TZ = 'America/Argentina/Buenos_Aires';
const ESTADO = {
  reservó: 'reservada',
  reprogramó: 'reprogramada',
  canceló: 'cancelada',
} as const;
const SANS = "font-family:'Helvetica Neue', Arial, sans-serif;";
const SERIF = 'font-family:Georgia, serif;';

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

/** Avisa a la alumna y a los admins cuando se agenda / reprograma / cancela una mentoría. */
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
    // La cuenta de la mentora organiza el evento y Google no le avisa por mail
    // de sus propios eventos: la sumamos acá.
    const mentorEmail =
      this.config.get<string>('GOOGLE_MENTOR_EMAIL') || 'cursos@merygarcia.com.ar';
    const to = admins.map((a) => ({ email: a.email, name: a.firstName ?? 'Admin' }));
    if (!to.some((t) => t.email.toLowerCase() === mentorEmail.toLowerCase())) {
      to.push({ email: mentorEmail, name: 'Mery Garcia' });
    }

    const email = new SibApiV3Sdk.SendSmtpEmail();
    email.sender = this.sender();
    email.to = to;
    email.subject = `Mentoría ${params.action}: ${params.studentName} — ${params.courseName}`;
    email.htmlContent = this.adminHtml(params);

    try {
      await this.api.sendTransacEmail(email);
      this.logger.log(`Aviso de mentoría (${params.action}) a ${to.length} destinatario(s)`);
    } catch (err) {
      this.logger.error('No se pudo avisar a los admins de la mentoría', err as Error);
    }
  }

  /**
   * Aviso aparte a los dueños (MENTORSHIP_ALERT_EMAILS, separados por coma),
   * con reintentos: no depende de que alguien de administración mire la web.
   * Devuelve si salió (o null si no hay a quién mandarlo).
   */
  async notifyOwners(params: BookingEmailParams): Promise<boolean | null> {
    const to = this.config
      .get<string>('MENTORSHIP_ALERT_EMAILS', '')
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean)
      .map((email) => ({ email }));
    if (!to.length) return null;
    const email = new SibApiV3Sdk.SendSmtpEmail();
    email.sender = this.sender();
    email.to = to;
    email.subject = `Mentoría ${params.action}: ${params.studentName} — ${params.courseName}`;
    email.htmlContent = this.adminHtml(params);
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await this.api.sendTransacEmail(email);
        this.logger.log(`Aviso de mentoría (${params.action}) a los dueños`);
        return true;
      } catch (err) {
        this.logger.error(
          `Aviso de mentoría a los dueños falló (intento ${attempt})`,
          err as Error,
        );
        if (attempt < 3) await new Promise((r) => setTimeout(r, attempt * 5000));
      }
    }
    return false;
  }

  /**
   * Confirmación a la alumna: al email del formulario y al de su cuenta (si son
   * distintos). No depende de la invitación de Google, que no siempre llega.
   */
  async notifyStudent(params: BookingEmailParams): Promise<void> {
    const recipients = [
      ...new Set(
        [params.meetingEmail, params.studentEmail]
          .filter(Boolean)
          .map((e) => e.trim().toLowerCase()),
      ),
    ];
    if (recipients.length === 0) return;

    const email = new SibApiV3Sdk.SendSmtpEmail();
    email.sender = this.sender();
    email.to = recipients.map((e) => ({ email: e, name: params.studentName }));
    email.subject = `Tu mentoría fue ${ESTADO[params.action]} — ${params.courseName}`;
    email.htmlContent = this.studentHtml(params);

    try {
      await this.api.sendTransacEmail(email);
      this.logger.log(`Confirmación de mentoría (${params.action}) a la alumna`);
    } catch (err) {
      this.logger.error('No se pudo enviar la confirmación a la alumna', err as Error);
    }
  }

  private studentHtml(params: BookingEmailParams): string {
    const estado = ESTADO[params.action];
    const cancelled = params.action === 'canceló';
    const frontendUrl = this.config.get<string>('FRONTEND_URL', '');
    return this.layout({
      eyebrow: 'Mentoría',
      title: `Tu mentoría<br>fue ${estado}`,
      intro: `Hola ${esc(params.studentName)}, tu mentoría de <strong>${esc(params.courseName)}</strong> fue ${estado}.`,
      rows: [['Curso', params.courseName], ...this.whenRows(params.start)],
      cta:
        !cancelled && params.meetLink
          ? { label: 'Unirme por Google Meet', url: params.meetLink }
          : undefined,
      note: cancelled
        ? undefined
        : 'La mentoría queda sujeta a confirmación de Mery García. Si hubiera que cambiar el horario, te avisamos.',
      link: { label: 'Ver en Mi cuenta', url: `${frontendUrl}/es/mi-cuenta` },
      footer: 'Recibís este correo porque tenés una mentoría en merygarcia.com.ar.',
    });
  }

  private adminHtml(params: BookingEmailParams): string {
    const frontendUrl = this.config.get<string>('FRONTEND_URL', '');
    return this.layout({
      eyebrow: 'Aviso interno',
      title: `Mentoría ${ESTADO[params.action]}`,
      intro: `<strong>${esc(params.studentName)}</strong> ${params.action} su mentoría de <strong>${esc(params.courseName)}</strong>.`,
      rows: [
        ['Alumna', `${params.studentName} · ${params.studentEmail}`],
        ['Email de la videollamada', params.meetingEmail],
        ...this.whenRows(params.start),
      ],
      cta: { label: 'Ver mentorías', url: `${frontendUrl}/es/admin/mentorias` },
      link: params.meetLink
        ? { label: 'Abrir Google Meet', url: params.meetLink }
        : undefined,
      footer: 'Aviso automático del portal de formaciones.',
    });
  }

  private whenRows(start: Date): [string, string][] {
    const date = start.toLocaleDateString('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: TZ,
    });
    const time = start.toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: TZ,
    });
    return [
      ['Fecha', date.charAt(0).toUpperCase() + date.slice(1)],
      ['Horario', `${time} hs · hora de Argentina`],
    ];
  }

  /** Estructura de la invitación a eventos de EmailService, con los colores de marca (rosa #EBA2A8 + negro). */
  private layout(o: LayoutOptions): string {
    const rows = o.rows
      .map(
        ([label, value], i) => `
                      <tr>
                        <td style="padding:14px 0;${i < o.rows.length - 1 ? ' border-bottom:1px solid #F7CBCB;' : ''}">
                          <div style="color:#545454; font-size:11px; letter-spacing:2.5px; text-transform:uppercase; margin-bottom:6px; ${SANS}">${esc(label)}</div>
                          <div style="color:#000000; font-size:18px; font-weight:500; letter-spacing:0.3px;">${esc(value)}</div>
                        </td>
                      </tr>`,
      )
      .join('');

    return `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin:0; padding:0; background-color:#FBE8EA; ${SERIF}">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#FBE8EA; padding:40px 12px;">
          <tr>
            <td align="center">
              <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%; background-color:#ffffff; border-top:4px solid #EBA2A8;">
                <tr>
                  <td style="padding:48px 40px 0; text-align:center;">
                    <img src="${EmailService.LOGO_URL}" width="150" alt="Mery García" style="display:block; margin:0 auto; width:150px; max-width:60%; height:auto; border:0;">
                  </td>
                </tr>
                <tr>
                  <td style="padding:40px 40px 0; text-align:center;">
                    <div style="color:#545454; font-size:11px; letter-spacing:4px; text-transform:uppercase; ${SANS} margin-bottom:18px;">${o.eyebrow}</div>
                    <h1 style="margin:0; color:#000000; font-size:32px; line-height:1.25; font-weight:normal; ${SERIF}">${o.title}</h1>
                    <div style="width:48px; height:2px; background-color:#EBA2A8; margin:24px auto 0; font-size:0; line-height:0;">&nbsp;</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:30px 40px 0;">
                    <p style="margin:0; color:#2B2B2B; font-size:16px; line-height:1.8; ${SERIF}">${o.intro}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:24px 40px 0;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #F7CBCB; border-bottom:1px solid #F7CBCB;">${rows}
                    </table>
                  </td>
                </tr>
                ${
                  o.cta
                    ? `<tr>
                  <td align="center" style="padding:32px 40px 0;">
                    <a href="${esc(o.cta.url)}" style="display:inline-block; background-color:#000000; color:#ffffff; text-decoration:none; padding:14px 32px; font-size:13px; letter-spacing:2px; text-transform:uppercase; ${SANS}">${o.cta.label}</a>
                  </td>
                </tr>`
                    : ''
                }
                ${
                  o.note
                    ? `<tr>
                  <td style="padding:28px 40px 0;">
                    <p style="margin:0; color:#545454; font-size:15px; line-height:1.8; ${SERIF}">${o.note}</p>
                  </td>
                </tr>`
                    : ''
                }
                ${
                  o.link
                    ? `<tr>
                  <td align="center" style="padding:24px 40px 0;">
                    <a href="${esc(o.link.url)}" style="color:#000000; font-size:14px; ${SANS}">${o.link.label}</a>
                  </td>
                </tr>`
                    : ''
                }
                <tr>
                  <td style="padding:48px 40px 48px; text-align:center;">
                    <p style="margin:0; color:#8a8a8a; font-size:11px; line-height:1.8; ${SANS} letter-spacing:0.3px;">
                      ${o.footer}<br>
                      © ${new Date().getFullYear()} Mery García · Todos los derechos reservados.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>`;
  }

  private sender() {
    return {
      name: 'Mery Garcia - Cosmetic Tattoo',
      email: this.config.get<string>('EMAIL_FROM', 'noreply@merygarcia.com'),
    };
  }
}
