import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { SettingsService } from '../settings/settings.service';

/**
 * Respuesta de GET {MERY_GARCIA_API_URL}/dolar/cotizacion — el backend de
 * mery-garcia expone el dólar blue (de dolarapi.com) y permite que lo pisen a
 * mano desde ese sistema, así que es la fuente de verdad del negocio.
 */
interface DolarResponse {
  compra: number;
  venta: number;
  casa?: string;
  nombre?: string;
  moneda?: string;
  fechaActualizacion?: string;
}

const REQUEST_TIMEOUT_MS = 10_000;

@Injectable()
export class DollarRateService {
  private readonly logger = new Logger(DollarRateService.name);
  private readonly apiUrl: string;

  constructor(
    private readonly settings: SettingsService,
    private readonly config: ConfigService,
  ) {
    this.apiUrl = (
      this.config.get<string>('MERY_GARCIA_API_URL') || ''
    ).replace(/\/$/, '');
  }

  /**
   * Trae la cotización y la guarda en settings. La llama el cron una vez por
   * día. No tira: si falla, queda la cotización anterior (o el dólar fijo).
   */
  async refresh(): Promise<{ rate: number | null; reason?: string }> {
    if (!(await this.settings.isPresencialDollarFromApi())) {
      return { rate: null, reason: 'modo fijo' };
    }
    if (!this.apiUrl) {
      this.logger.warn(
        'MERY_GARCIA_API_URL no configurada: no se puede traer la cotización',
      );
      return { rate: null, reason: 'sin URL' };
    }

    try {
      const { data } = await axios.get<DolarResponse>(
        `${this.apiUrl}/dolar/cotizacion`,
        { timeout: REQUEST_TIMEOUT_MS },
      );
      // Se cobra al valor de venta: es el que paga quien compra dólares.
      const rate = Number(data?.venta);
      if (!Number.isFinite(rate) || rate <= 0) {
        this.logger.warn(`Cotización inválida recibida: ${JSON.stringify(data)}`);
        return { rate: null, reason: 'respuesta inválida' };
      }
      await this.settings.setPresencialCachedDollarRate(rate);
      this.logger.log(`💵 Cotización actualizada: $${Math.round(rate)} por USD`);
      return { rate };
    } catch (err) {
      this.logger.error(
        `No se pudo traer la cotización del dólar: ${(err as Error).message}`,
      );
      return { rate: null, reason: 'error de red' };
    }
  }
}
