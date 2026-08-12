import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as SibApiV3Sdk from '@sendinblue/client';

interface RewardEmailParams {
  to: { email: string; name: string };
  code: string;
  discountPercent: number;
  validToLabel: string;
}

/**
 * Emails del módulo de promos. Por ahora solo el aviso de cupón-regalo emitido.
 */
@Injectable()
export class PromoEmailService {
  private readonly logger = new Logger(PromoEmailService.name);
  private readonly api: SibApiV3Sdk.TransactionalEmailsApi;

  constructor(private readonly config: ConfigService) {
    this.api = new SibApiV3Sdk.TransactionalEmailsApi();
    this.api.setApiKey(
      SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey,
      this.config.get<string>('BREVO_API_KEY', ''),
    );
  }

  async sendRewardCoupon(params: RewardEmailParams): Promise<boolean> {
    const frontendUrl = this.config.get<string>('FRONTEND_URL', '');
    const shopUrl = `${frontendUrl}/es`;

    const email = new SibApiV3Sdk.SendSmtpEmail();
    email.sender = {
      name: 'Mery Garcia - Cosmetic Tattoo',
      email: this.config.get<string>('EMAIL_FROM', 'noreply@merygarcia.com'),
    };
    email.to = [params.to];
    email.subject = `Tu regalo: ${params.discountPercent}% OFF en tu próxima formación 🎁`;
    email.htmlContent = this.template(params, shopUrl);

    try {
      await this.api.sendTransacEmail(email);
      return true;
    } catch (err) {
      this.logger.error(
        `No se pudo enviar el cupón-regalo a ${params.to.email}`,
        err as Error,
      );
      return false;
    }
  }

  private template(params: RewardEmailParams, shopUrl: string): string {
    return `
      <div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:0 auto;color:#3a1f26">
        <h2 style="color:#660e1b">¡Gracias por tu compra! 🎉</h2>
        <p>Como agradecimiento, te dejamos un cupón de <strong>${params.discountPercent}% de descuento</strong>
        para que uses en <strong>otra formación</strong> de Mery Garcia.</p>
        <div style="background:#f7eaec;border-radius:12px;padding:20px;text-align:center;margin:20px 0">
          <div style="font-size:12px;color:#8a5b64;text-transform:uppercase;letter-spacing:1px">Tu código</div>
          <div style="font-size:26px;font-weight:800;color:#660e1b;letter-spacing:2px">${params.code}</div>
        </div>
        <p style="font-size:14px">Válido hasta <strong>${params.validToLabel}</strong>. Se aplica en el checkout
        sobre una formación que todavía no tengas.</p>
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
