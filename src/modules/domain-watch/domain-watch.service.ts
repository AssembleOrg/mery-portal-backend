import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as SibApiV3Sdk from '@sendinblue/client';
import { Resolver } from 'node:dns/promises';

const DOMAIN = 'merygarcia.com.ar';
const CHECK_URL = `https://${DOMAIN}/robots.txt`;
const REQUEST_TIMEOUT_MS = 10_000;
/** Controles fallidos seguidos (uno cada 5 minutos) antes de avisar. */
const FAILURES_BEFORE_ALERT = 3;

export type DomainCheck = { ok: true; ip: string } | { ok: false; reason: string };

/**
 * Vigila que el dominio principal siga respondiendo. Hostinger tiene un registro
 * A con una dirección fija de Railway porque su ALIAS daba SERVFAIL; si Railway
 * deja de atender esa dirección hay que actualizar el registro a mano.
 */
@Injectable()
export class DomainWatchService {
  private readonly logger = new Logger(DomainWatchService.name);
  private readonly api: SibApiV3Sdk.TransactionalEmailsApi;
  private failures = 0;
  private alerted = false;
  private running = false;

  constructor(private readonly config: ConfigService) {
    this.api = new SibApiV3Sdk.TransactionalEmailsApi();
    this.api.setApiKey(
      SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey,
      this.config.get<string>('BREVO_API_KEY', ''),
    );
  }

  @Cron(CronExpression.EVERY_5_MINUTES, { name: 'domain-watch' })
  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const result = await this.check();
      if (result.ok) {
        const recovered = this.alerted;
        this.failures = 0;
        this.alerted = false;
        if (recovered) await this.notify(`✅ ${DOMAIN} volvió a responder`, `Responde en ${result.ip}.`);
        return;
      }
      this.failures++;
      this.logger.warn(`Control de ${DOMAIN} falló (${this.failures}): ${result.reason}`);
      if (this.failures >= FAILURES_BEFORE_ALERT && !this.alerted) {
        this.alerted = true;
        await this.notify(
          `⚠️ ${DOMAIN} no responde`,
          `Último error: ${result.reason}. Revisar el registro A de @ en Hostinger contra la dirección actual de 9h4ktykq.up.railway.app.`,
        );
      }
    } finally {
      this.running = false;
    }
  }

  async check(): Promise<DomainCheck> {
    let ip: string | undefined;
    try {
      const resolver = new Resolver({ timeout: 5_000, tries: 2 });
      resolver.setServers(['8.8.8.8', '1.1.1.1']);
      [ip] = await resolver.resolve4(DOMAIN);
    } catch (err) {
      return { ok: false, reason: `DNS: ${(err as Error).message}` };
    }
    if (!ip) return { ok: false, reason: 'DNS: sin dirección' };
    try {
      const res = await fetch(CHECK_URL, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      return res.ok ? { ok: true, ip } : { ok: false, reason: `HTTP ${res.status} en ${ip}` };
    } catch (err) {
      return { ok: false, reason: `Conexión a ${ip}: ${(err as Error).message}` };
    }
  }

  private async notify(subject: string, text: string): Promise<void> {
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
    email.subject = subject;
    email.textContent = text;
    try {
      await this.api.sendTransacEmail(email);
    } catch (err) {
      this.logger.error('Aviso del dominio falló', err as Error);
    }
  }
}
