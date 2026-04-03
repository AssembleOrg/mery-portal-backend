import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ProblemReportData {
  email: string;
  phone?: string;
  description: string;
  recentRequests?: unknown[];
}

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  private readonly pistechApiUrl: string;
  private readonly pistechApiKey: string;
  private readonly pistechGroupJid: string;
  private readonly appName: string;

  constructor(private readonly configService: ConfigService) {
    this.pistechApiUrl = this.configService.get<string>('PISTECH_WHATSAPP_API_URL', '');
    this.pistechApiKey = this.configService.get<string>('PISTECH_WHATSAPP_API_KEY', '');
    this.pistechGroupJid = this.configService.get<string>('PISTECH_WHATSAPP_GROUP_JID', '');
    this.appName = this.configService.get<string>('PROBLEM_REPORT_APP_NAME', 'Frontend Web Mery');
  }

  isConfigured(): boolean {
    return !!(this.pistechApiUrl && this.pistechApiKey && this.pistechGroupJid);
  }

  async reportProblem(data: ProblemReportData): Promise<void> {
    if (!this.isConfigured()) {
      this.logger.warn('Pistech WhatsApp API no configurada. Reporte no enviado.');
      return;
    }

    const now = new Date();
    const timestamp = now.toLocaleString('es-AR', {
      timeZone: 'America/Argentina/Buenos_Aires',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const dateForFilename = now.toISOString().slice(0, 10);

    const caption = [
      '*REPORTE DE PROBLEMA*',
      `*App:* ${this.appName}`,
      `*Fecha:* ${timestamp}`,
      '',
      '*Descripción:*',
      data.description,
      '',
      '*Datos de contacto:*',
      `• Email: ${data.email}`,
      ...(data.phone ? [`• Tel: ${data.phone}`] : []),
    ].join('\n');

    const jsonReport = {
      appName: this.appName,
      timestamp: now.toISOString(),
      userId: data.email,
      description: data.description,
      contact: {
        email: data.email,
        phone: data.phone || null,
      },
      recentRequests: data.recentRequests || [],
    };

    const base64 = Buffer.from(JSON.stringify(jsonReport, null, 2)).toString('base64');

    try {
      const response = await fetch(`${this.pistechApiUrl}/api/send/document`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.pistechApiKey,
        },
        body: JSON.stringify({
          to: this.pistechGroupJid,
          base64,
          filename: `reporte-${dateForFilename}.json`,
          mimetype: 'application/json',
          caption,
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        this.logger.error(`Error enviando reporte a WhatsApp (${response.status}): ${body}`);
        return;
      }

      this.logger.log(`Reporte de problema enviado al grupo WhatsApp desde ${data.email}`);
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error enviando reporte a WhatsApp: ${err.message}`, err.stack);
    }
  }
}
