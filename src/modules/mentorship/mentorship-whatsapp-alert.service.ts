import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { BookingEmailParams } from './mentorship-email.service';

const TZ = 'America/Argentina/Buenos_Aires';
const ESTADO = {
  reservó: 'reservada',
  reprogramó: 'reprogramada',
  canceló: 'cancelada',
} as const;
const ICON = { reservó: '🎓', reprogramó: '🔁', canceló: '❌' } as const;

/**
 * WhatsApp al dueño cuando se reserva, reprograma o cancela una mentoría. Sale
 * por Costear (POST MENTORSHIP_ALERT_WHATSAPP_URL, que es
 * {costear}/api/v1/alerts/owner, con X-Alerts-Secret) y le llega a su chat.
 * Si falta la configuración, no hace nada.
 */
@Injectable()
export class MentorshipWhatsappAlertService {
  private readonly logger = new Logger(MentorshipWhatsappAlertService.name);

  constructor(private readonly config: ConfigService) {}

  async notify(
    params: BookingEmailParams,
    mailSent: boolean | null,
  ): Promise<void> {
    await this.sendText(this.text(params, mailSent));
  }

  /** Manda un texto libre al chat del dueño (con 3 reintentos). */
  async sendText(text: string): Promise<void> {
    const url = this.config.get<string>('MENTORSHIP_ALERT_WHATSAPP_URL', '');
    const secret = this.config.get<string>(
      'MENTORSHIP_ALERT_WHATSAPP_SECRET',
      '',
    );
    if (!url || !secret) return;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Alerts-Secret': secret,
          },
          body: JSON.stringify({ text }),
          signal: AbortSignal.timeout(30_000),
        });
        if (!res.ok) throw new Error(`Costear respondió ${res.status}`);
        return;
      } catch (err) {
        this.logger.error(
          `WhatsApp de mentoría falló (intento ${attempt}): ${(err as Error).message}`,
        );
        if (attempt < 3)
          await new Promise((r) => setTimeout(r, attempt * 30_000));
      }
    }
  }

  text(p: BookingEmailParams, mailSent: boolean | null): string {
    const when = p.start.toLocaleString('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: TZ,
    });
    const lines = [
      `${ICON[p.action]} *Mentoría ${ESTADO[p.action]}* · portal de formaciones`,
      `${p.studentName} — ${p.courseName}`,
      `📅 ${when} hs`,
      `✉️ ${p.meetingEmail}${p.meetingEmail !== p.studentEmail ? ` (cuenta: ${p.studentEmail})` : ''}`,
    ];
    if (p.meetLink && p.action !== 'canceló') lines.push(`🔗 ${p.meetLink}`);
    if (mailSent === true) lines.push('', 'Mail enviado ✅');
    if (mailSent === false)
      lines.push('', '⚠️ El mail no salió (Brevo): revisar.');
    return lines.join('\n');
  }
}
