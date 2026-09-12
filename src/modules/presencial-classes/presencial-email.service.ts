import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as SibApiV3Sdk from '@sendinblue/client';

export interface PresencialEmailClass {
  title: string;
  startAt: Date;
  startHour: number;
  endHour: number;
  categoryNames: string[];
}

const TZ = 'America/Argentina/Buenos_Aires';
const BRAND = '#660e1b';

/** Emails a la alumna sobre su clase presencial (confirmada / sin lugar / cancelada). */
@Injectable()
export class PresencialEmailService {
  private readonly logger = new Logger(PresencialEmailService.name);
  private readonly api: SibApiV3Sdk.TransactionalEmailsApi;

  constructor(private readonly config: ConfigService) {
    this.api = new SibApiV3Sdk.TransactionalEmailsApi();
    this.api.setApiKey(
      SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey,
      this.config.get<string>('BREVO_API_KEY', ''),
    );
  }

  private when(cls: PresencialEmailClass): string {
    const day = cls.startAt.toLocaleDateString('es-AR', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: TZ,
    });
    const hh = (h: number) => `${String(h).padStart(2, '0')}:00`;
    return `${day} · ${hh(cls.startHour)} a ${hh(cls.endHour)} hs`;
  }

  private async send(to: { email: string; name: string }, subject: string, body: string) {
    const frontendUrl = this.config.get<string>('FRONTEND_URL', '');
    const email = new SibApiV3Sdk.SendSmtpEmail();
    email.sender = {
      name: 'Mery Garcia - Cosmetic Tattoo',
      email: this.config.get<string>('EMAIL_FROM', 'noreply@merygarcia.com'),
    };
    email.to = [to];
    email.subject = subject;
    email.htmlContent = `
      <div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:0 auto;color:#3a1f26">
        ${body}
        <p style="margin-top:24px"><a href="${frontendUrl}/es/mi-cuenta"
          style="background:${BRAND};color:#fff;text-decoration:none;padding:10px 20px;border-radius:999px;font-weight:700">
          Ver en mi cuenta</a></p>
        <p style="margin-top:24px;font-size:12px;color:#8a6a70">Mery Garcia · Cosmetic Tattoo</p>
      </div>`;
    try {
      await this.api.sendTransacEmail(email);
    } catch (err) {
      this.logger.error(`No se pudo enviar "${subject}" a ${to.email}`, err as Error);
    }
  }

  private greet(name: string) {
    return `<p>Hola ${name || ''}!</p>`;
  }

  private classBlock(cls: PresencialEmailClass) {
    const cats = cls.categoryNames.length
      ? `<p style="margin:4px 0 0;color:#6b4a52">Formación: ${cls.categoryNames.join(', ')}</p>`
      : '';
    return `
      <div style="border:1px solid #f0d9dd;border-radius:12px;padding:14px 16px;margin:16px 0">
        <p style="margin:0;font-weight:700">${cls.title}</p>
        <p style="margin:4px 0 0;text-transform:capitalize">${this.when(cls)}</p>
        ${cats}
      </div>`;
  }

  async sendConfirmed(to: { email: string; name: string }, cls: PresencialEmailClass) {
    await this.send(
      to,
      `Confirmada ✅ tu clase presencial: ${cls.title}`,
      `${this.greet(to.name)}
       <h2 style="color:${BRAND};margin:8px 0">Tu clase presencial está confirmada</h2>
       <p>Te confirmamos tu lugar en la clase presencial. Estos son los datos:</p>
       ${this.classBlock(cls)}
       <p>Cualquier cambio te lo avisamos por acá y en tu cuenta. ¡Te esperamos!</p>`,
    );
  }

  async sendRejected(to: { email: string; name: string }, cls: PresencialEmailClass) {
    await this.send(
      to,
      `Sobre tu inscripción a ${cls.title}`,
      `${this.greet(to.name)}
       <h2 style="color:${BRAND};margin:8px 0">No pudimos confirmar tu lugar</h2>
       <p>Esta vez no pudimos confirmar tu inscripción a la clase:</p>
       ${this.classBlock(cls)}
       <p>Podés anotarte a otra fecha desde tu cuenta. Si tenés dudas, escribinos.</p>`,
    );
  }

  async sendClassCancelled(to: { email: string; name: string }, cls: PresencialEmailClass) {
    await this.send(
      to,
      `Cancelada: clase presencial ${cls.title}`,
      `${this.greet(to.name)}
       <h2 style="color:${BRAND};margin:8px 0">La clase presencial se canceló</h2>
       <p>Lamentablemente esta fecha se canceló:</p>
       ${this.classBlock(cls)}
       <p>Ya podés anotarte a otra fecha desde tu cuenta. Disculpá las molestias.</p>`,
    );
  }
}
