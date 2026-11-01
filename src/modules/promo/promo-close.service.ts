import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as SibApiV3Sdk from '@sendinblue/client';
import { PrismaService } from '../../shared/services';
import { SettingsService } from '../settings/settings.service';
import { PROMO_AUTO_CLOSE_AT_KEY } from '../settings/setting-definitions';

export interface RestoredPrice {
  name: string;
  priceARS: number;
  priceUSD: number;
  restoredARS: number;
  restoredUSD: number;
}

/** Intentos fallidos seguidos (uno por minuto) antes de abandonar y avisar. */
const MAX_ATTEMPTS = 3;

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

/**
 * Cierre automático de la promo de formaciones. La promo baja los precios en
 * video_categories guardando el original en originalPrice*; al llegar la fecha
 * de `promo.autoCloseAt` se restauran (mismo efecto que
 * scripts/rollback-promo-40.sql), se limpia la setting y se avisa por mail,
 * salga bien o mal.
 */
@Injectable()
export class PromoCloseService {
  private readonly logger = new Logger(PromoCloseService.name);
  private readonly api: SibApiV3Sdk.TransactionalEmailsApi;
  private running = false;
  private failures = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly config: ConfigService,
  ) {
    this.api = new SibApiV3Sdk.TransactionalEmailsApi();
    this.api.setApiKey(
      SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey,
      this.config.get<string>('BREVO_API_KEY', ''),
    );
  }

  @Cron(CronExpression.EVERY_MINUTE, { name: 'promo-auto-close' })
  async tick(now = new Date()): Promise<void> {
    if (this.running) return;
    const raw = (await this.settings.getString(PROMO_AUTO_CLOSE_AT_KEY)).trim();
    if (!raw) return;
    const closeAt = new Date(raw);
    if (Number.isNaN(closeAt.getTime()) || now < closeAt) return;

    this.running = true;
    try {
      const restored = await this.restorePrices();
      await this.settings.set(PROMO_AUTO_CLOSE_AT_KEY, '');
      this.failures = 0;
      this.logger.log(`🏷️ Promo cerrada: ${restored.length} curso(s) con precio restaurado`);
      await this.notify(raw, restored, null);
    } catch (err) {
      this.failures++;
      this.logger.error(`Cierre de la promo falló (intento ${this.failures})`, err as Error);
      if (this.failures >= MAX_ATTEMPTS) {
        await this.settings.set(PROMO_AUTO_CLOSE_AT_KEY, '').catch(() => undefined);
        this.failures = 0;
        await this.notify(raw, [], (err as Error).message ?? String(err));
      }
    } finally {
      this.running = false;
    }
  }

  /** Vuelve los precios al snapshot, refresca carritos y limpia el snapshot. */
  async restorePrices(): Promise<RestoredPrice[]> {
    return this.prisma.$transaction(async (tx) => {
      const onPromo = await tx.videoCategory.findMany({
        where: {
          OR: [{ originalPriceARS: { not: null } }, { originalPriceUSD: { not: null } }],
        },
        select: {
          id: true,
          name: true,
          priceARS: true,
          priceUSD: true,
          originalPriceARS: true,
          originalPriceUSD: true,
        },
        orderBy: { order: 'asc' },
      });

      const restored: RestoredPrice[] = [];
      for (const c of onPromo) {
        const priceARS = c.originalPriceARS ?? c.priceARS;
        const priceUSD = c.originalPriceUSD ?? c.priceUSD;
        await tx.videoCategory.update({
          where: { id: c.id },
          data: { priceARS, priceUSD, originalPriceARS: null, originalPriceUSD: null },
        });
        await tx.cartItem.updateMany({
          where: { categoryId: c.id },
          data: { priceARS, priceUSD },
        });
        restored.push({
          name: c.name,
          priceARS: Number(c.priceARS),
          priceUSD: Number(c.priceUSD),
          restoredARS: Number(priceARS),
          restoredUSD: Number(priceUSD),
        });
      }
      return restored;
    });
  }

  private async notify(closeAt: string, restored: RestoredPrice[], error: string | null) {
    const to = this.config
      .get<string>('MENTORSHIP_ALERT_EMAILS', '')
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean)
      .map((email) => ({ email }));
    if (!to.length) return;

    const email = new SibApiV3Sdk.SendSmtpEmail();
    email.sender = {
      name: 'Mery Garcia - Cosmetic Tattoo',
      email: this.config.get<string>('EMAIL_FROM', 'noreply@merygarcia.com'),
    };
    email.to = to;
    email.subject = error
      ? '⚠️ La promo de formaciones NO se cerró sola: revisar a mano'
      : `✅ Promo de formaciones cerrada: ${restored.length} precio(s) restaurado(s)`;
    email.htmlContent = this.html(closeAt, restored, error);

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await this.api.sendTransacEmail(email);
        return;
      } catch (err) {
        this.logger.error(`Aviso del cierre de la promo falló (intento ${attempt})`, err as Error);
        if (attempt < 3) await new Promise((r) => setTimeout(r, attempt * 5000));
      }
    }
  }

  private html(closeAt: string, restored: RestoredPrice[], error: string | null): string {
    const ars = (n: number) => `$${n.toLocaleString('es-AR')}`;
    const usd = (n: number) => `USD ${n.toLocaleString('en-US')}`;
    const rows = restored
      .map(
        (r) => `<tr>
          <td style="padding:6px 10px;border-bottom:1px solid #eee">${esc(r.name)}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee">${ars(r.priceARS)} → <strong>${ars(r.restoredARS)}</strong></td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee">${usd(r.priceUSD)} → <strong>${usd(r.restoredUSD)}</strong></td>
        </tr>`,
      )
      .join('');
    const body = error
      ? `<p>El cierre automático programado para <strong>${esc(closeAt)}</strong> falló ${MAX_ATTEMPTS} veces y se dejó de intentar.</p>
         <p>Error: <code>${esc(error)}</code></p>
         <p>Los precios siguen con descuento: hay que restaurarlos a mano con <code>scripts/rollback-promo-40.sql</code>.</p>`
      : restored.length
        ? `<p>Cierre programado para <strong>${esc(closeAt)}</strong>: se volvieron a poner los precios previos a la promo (y se actualizaron los carritos).</p>
           <table style="border-collapse:collapse;font-size:14px">${rows}</table>`
        : `<p>Cierre programado para <strong>${esc(closeAt)}</strong>: no había cursos con precio de promo para restaurar.</p>`;
    return `<div style="font-family:Arial,sans-serif;color:#2b2b2b;max-width:640px">
      <h2 style="font-weight:normal">Promo de formaciones · merygarcia.com.ar</h2>
      ${body}
    </div>`;
  }
}
