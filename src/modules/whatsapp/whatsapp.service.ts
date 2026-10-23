import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ProblemReportData {
  email: string;
  phone?: string;
  description: string;
  recentRequests?: unknown[];
  url?: string;
}

// El panel guarda hasta 20.000 caracteres de meta: si las requests no entran, se
// mandan sin bodies y, si aun así no entran, solo las últimas.
const MAX_META_CHARS = 18000;

/** Reduce las requests recientes hasta que el meta entre en el límite del panel. */
export function buildReportMeta(data: ProblemReportData): string {
  const base = {
    source: 'formulario-propio',
    contact: { email: data.email, phone: data.phone || null },
  };
  const requests = Array.isArray(data.recentRequests) ? data.recentRequests : [];
  const slim = requests.map((r) => {
    if (!r || typeof r !== 'object') return r;
    const { method, url, statusCode, timestamp, durationMs } = r as Record<string, unknown>;
    return { method, url, statusCode, timestamp, durationMs };
  });
  for (const candidate of [requests, slim, slim.slice(-10), []]) {
    const json = JSON.stringify({ ...base, recentRequests: candidate });
    if (json.length <= MAX_META_CHARS) return json;
  }
  return JSON.stringify(base);
}

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  // Panel de ayuda de Pistech (whatsapp-pistech-neonize): el reporte entra como
  // uno del widget, con historial, y avisa al grupo de soporte.
  private readonly reportEndpoint: string;
  private readonly reportToken: string;

  constructor(private readonly configService: ConfigService) {
    this.reportEndpoint = this.configService
      .get<string>(
        'PISTECH_REPORT_ENDPOINT',
        'https://whatsapp-pistech-neonize-production.up.railway.app',
      )
      .replace(/\/$/, '');
    this.reportToken = this.configService.get<string>('PISTECH_REPORT_TOKEN', '');
  }

  isConfigured(): boolean {
    return !!(this.reportEndpoint && this.reportToken);
  }

  async reportProblem(data: ProblemReportData): Promise<void> {
    if (!this.isConfigured()) {
      this.logger.warn('PISTECH_REPORT_TOKEN no configurado. Reporte no enviado.');
      return;
    }

    const description = [
      data.description,
      '',
      `Email: ${data.email}`,
      ...(data.phone ? [`Tel: ${data.phone}`] : []),
    ].join('\n');

    const form = new FormData();
    form.append('description', description);
    form.append('userId', data.email);
    form.append('category', 'bug');
    if (data.url) form.append('url', data.url);
    form.append('meta', buildReportMeta(data));

    try {
      const response = await fetch(`${this.reportEndpoint}/api/report`, {
        method: 'POST',
        headers: { 'X-Project-Token': this.reportToken },
        body: form,
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        const body = await response.text();
        this.logger.error(`Error enviando reporte al panel de Pistech (${response.status}): ${body}`);
        return;
      }

      this.logger.log(`Reporte de problema enviado al panel de Pistech desde ${data.email}`);
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error enviando reporte al panel de Pistech: ${err.message}`, err.stack);
    }
  }
}
