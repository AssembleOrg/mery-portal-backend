import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as SibApiV3Sdk from '@sendinblue/client';

interface ThankYouParams {
  to: { email: string; name: string };
  courseNames: string[];
  code: string;
  discountPercent: number;
  validToLabel: string;
}

/** Email de agradecimiento por la compra + cupón-regalo personal. */
@Injectable()
export class RewardEmailService {
  private readonly logger = new Logger(RewardEmailService.name);
  private readonly api: SibApiV3Sdk.TransactionalEmailsApi;

  constructor(private readonly config: ConfigService) {
    this.api = new SibApiV3Sdk.TransactionalEmailsApi();
    this.api.setApiKey(
      SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey,
      this.config.get<string>('BREVO_API_KEY', ''),
    );
  }

  async sendThankYou(params: ThankYouParams): Promise<boolean> {
    const frontendUrl = this.config.get<string>('FRONTEND_URL', '');
    const shopUrl = `${frontendUrl}/es`;

    const email = new SibApiV3Sdk.SendSmtpEmail();
    email.sender = {
      name: 'Mery Garcia - Cosmetic Tattoo',
      email: this.config.get<string>('EMAIL_FROM', 'noreply@merygarcia.com'),
    };
    email.to = [params.to];
    email.subject = `¡Gracias por tu compra! Tu ${params.discountPercent}% OFF para la próxima 🎁`;
    email.htmlContent = this.template(params, shopUrl);

    try {
      await this.api.sendTransacEmail(email);
      return true;
    } catch (err) {
      this.logger.error(
        `No se pudo enviar el email de agradecimiento a ${params.to.email}`,
        err as Error,
      );
      return false;
    }
  }

  private template(params: ThankYouParams, shopUrl: string): string {
    const courses = params.courseNames.length
      ? `<p style="font-size:14px">Tu compra: <strong>${params.courseNames.join(
          ', ',
        )}</strong>.</p>`
      : '';
    return `
      <div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:0 auto;color:#3a1f26">
        <h2 style="color:#660e1b">¡Gracias por tu compra! 🎉</h2>
        ${courses}
        <p>Como agradecimiento, te dejamos un cupón de <strong>${params.discountPercent}% de descuento</strong>
        para tu <strong>próxima formación</strong>.</p>
        <div style="background:#f7eaec;border-radius:12px;padding:20px;text-align:center;margin:20px 0">
          <div style="font-size:12px;color:#8a5b64;text-transform:uppercase;letter-spacing:1px">Tu código personal</div>
          <div style="font-size:26px;font-weight:800;color:#660e1b;letter-spacing:2px">${params.code}</div>
        </div>
        <p style="font-size:14px">Es exclusivo de tu cuenta, válido hasta <strong>${params.validToLabel}</strong>,
        y se aplica sobre una formación que todavía no tengas.</p>
        <p style="text-align:center;margin:28px 0">
          <a href="${shopUrl}" style="background:#660e1b;color:#fff;text-decoration:none;padding:12px 24px;border-radius:999px;font-weight:700">
            Ver formaciones
          </a>
        </p>
        <p style="font-size:12px;color:#8a5b64">Si el botón no funciona, entrá a ${shopUrl}</p>
      </div>
    `;
  }
}
