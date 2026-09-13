import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, PresencialDepositStatus, PresencialSignupStatus } from '@prisma/client';
import axios from 'axios';
import { PrismaService } from '../../shared/services';
import { SettingsService } from '../settings/settings.service';

const MP_PREFERENCES_URL = 'https://api.mercadopago.com/checkout/preferences';
const REQUEST_TIMEOUT_MS = 15_000;

export interface DepositQuote {
  /** Monto que se cobra por Mercado Pago, siempre en pesos. */
  amountARS: number;
  /** Precio de lista en dólares, si el precio está expresado en USD. */
  amountUSD: number | null;
  /** Cotización usada para convertir (null si el precio ya estaba en pesos). */
  rate: number | null;
  priceName: string;
}

@Injectable()
export class PresencialDepositsService {
  private readonly logger = new Logger(PresencialDepositsService.name);
  private readonly accessToken: string;
  private readonly frontendUrl: string;
  private readonly webhookUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly config: ConfigService,
  ) {
    this.accessToken = this.config.get<string>('MP_ACCESS_TOKEN') || '';
    this.frontendUrl = (
      this.config.get<string>('FRONTEND_URL') || ''
    ).replace(/\/$/, '');
    this.webhookUrl = this.config.get<string>('MP_WEBHOOK_URL') || '';
  }

  // ---------------------------------------------------------------------------
  // Precio
  // ---------------------------------------------------------------------------

  /**
   * Monto autoritativo de la seña de una clase. Lo calcula SIEMPRE el backend:
   * el cliente nunca manda precios.
   *
   * Si el precio tiene monto en pesos se cobra ese; si solo tiene dólares, se
   * convierte con la cotización vigente. null = la clase no cobra seña.
   */
  async quoteForClass(classId: string): Promise<DepositQuote | null> {
    const klass = await this.prisma.presencialClass.findUnique({
      where: { id: classId },
      include: { price: true },
    });
    if (!klass) throw new NotFoundException('Clase presencial no encontrada');
    return this.quoteForPrice(klass.price);
  }

  async quoteForPrice(
    price: {
      name: string;
      amountARS: Prisma.Decimal | null;
      amountUSD: Prisma.Decimal | null;
      isActive: boolean;
    } | null,
  ): Promise<DepositQuote | null> {
    if (!price || !price.isActive) return null;

    if (price.amountARS != null) {
      const amountARS = Number(price.amountARS);
      if (amountARS <= 0) return null;
      return { amountARS, amountUSD: null, rate: null, priceName: price.name };
    }

    if (price.amountUSD == null) return null;
    const amountUSD = Number(price.amountUSD);
    if (amountUSD <= 0) return null;

    const { rate } = await this.settings.getPresencialDollarRate();
    if (!rate || rate <= 0) return null;

    return {
      amountARS: Math.round(amountUSD * rate),
      amountUSD,
      rate,
      priceName: price.name,
    };
  }

  // ---------------------------------------------------------------------------
  // Listado de precios (admin)
  // ---------------------------------------------------------------------------

  async listPrices(onlyActive = false) {
    const rows = await this.prisma.presencialPrice.findMany({
      where: onlyActive ? { isActive: true } : undefined,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map((p) => this.serializePrice(p));
  }

  async createPrice(dto: {
    name: string;
    amountUSD?: number | null;
    amountARS?: number | null;
    isActive?: boolean;
    sortOrder?: number;
  }) {
    this.assertHasAmount(dto.amountUSD, dto.amountARS);
    const row = await this.prisma.presencialPrice.create({
      data: {
        name: dto.name.trim(),
        amountUSD: this.toDecimal(dto.amountUSD),
        amountARS: this.toDecimal(dto.amountARS),
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
    return this.serializePrice(row);
  }

  async updatePrice(
    id: string,
    dto: {
      name?: string;
      amountUSD?: number | null;
      amountARS?: number | null;
      isActive?: boolean;
      sortOrder?: number;
    },
  ) {
    const current = await this.prisma.presencialPrice.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Precio no encontrado');

    const nextUSD =
      dto.amountUSD === undefined ? Number(current.amountUSD ?? 0) || null : dto.amountUSD;
    const nextARS =
      dto.amountARS === undefined ? Number(current.amountARS ?? 0) || null : dto.amountARS;
    this.assertHasAmount(nextUSD, nextARS);

    const row = await this.prisma.presencialPrice.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.amountUSD !== undefined
          ? { amountUSD: this.toDecimal(dto.amountUSD) }
          : {}),
        ...(dto.amountARS !== undefined
          ? { amountARS: this.toDecimal(dto.amountARS) }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      },
    });
    return this.serializePrice(row);
  }

  /**
   * Borra un precio. Las clases que lo usaban quedan sin seña (priceId null por
   * la FK), así que se avisa cuántas fechas se ven afectadas.
   */
  async deletePrice(id: string) {
    const used = await this.prisma.presencialClass.count({ where: { priceId: id } });
    await this.prisma.presencialPrice.delete({ where: { id } }).catch(() => {
      throw new NotFoundException('Precio no encontrado');
    });
    return { deleted: true, classesLeftWithoutPrice: used };
  }

  private assertHasAmount(usd?: number | null, ars?: number | null) {
    const hasUSD = usd != null && usd > 0;
    const hasARS = ars != null && ars > 0;
    if (!hasUSD && !hasARS) {
      throw new BadRequestException(
        'Cargá un monto en dólares o en pesos (al menos uno)',
      );
    }
  }

  private toDecimal(v?: number | null): Prisma.Decimal | null {
    return v != null && v > 0 ? new Prisma.Decimal(v) : null;
  }

  private serializePrice(p: {
    id: string;
    name: string;
    amountUSD: Prisma.Decimal | null;
    amountARS: Prisma.Decimal | null;
    isActive: boolean;
    sortOrder: number;
  }) {
    return {
      id: p.id,
      name: p.name,
      amountUSD: p.amountUSD != null ? Number(p.amountUSD) : null,
      amountARS: p.amountARS != null ? Number(p.amountARS) : null,
      isActive: p.isActive,
      sortOrder: p.sortOrder,
    };
  }

  // ---------------------------------------------------------------------------
  // Alta de la seña
  // ---------------------------------------------------------------------------

  /**
   * Arranca el pago de la seña. El disclaimer se acepta ANTES de crear la
   * preference: lo que se reserva es el derecho a una presencialidad, no la
   * fecha, así que la alumna tiene que haberlo leído sí o sí.
   */
  async start(params: {
    userId: string;
    classId: string;
    acceptedDisclaimer: boolean;
  }) {
    const { userId, classId, acceptedDisclaimer } = params;

    if (!acceptedDisclaimer) {
      throw new BadRequestException(
        'Tenés que aceptar las condiciones de la reserva para continuar',
      );
    }
    if (!this.accessToken) {
      throw new BadRequestException(
        'El cobro no está disponible en este momento. Escribinos y lo resolvemos.',
      );
    }

    const quote = await this.quoteForClass(classId);
    if (!quote) {
      throw new BadRequestException('Esta fecha todavía no tiene seña definida');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, firstName: true, lastName: true },
    });
    if (!user) throw new NotFoundException('Usuaria no encontrada');

    const existing = await this.prisma.presencialSignup.findUnique({
      where: { classId_userId: { classId, userId } },
    });
    if (existing?.depositStatus === PresencialDepositStatus.PAID) {
      throw new ConflictException('Ya señaste esta fecha');
    }

    const now = new Date();
    const depositData = {
      disclaimerAcceptedAt: now,
      depositStatus: PresencialDepositStatus.PENDING,
      depositAmountARS: new Prisma.Decimal(quote.amountARS),
      depositAmountUSD:
        quote.amountUSD != null ? new Prisma.Decimal(quote.amountUSD) : null,
      depositRate: quote.rate != null ? new Prisma.Decimal(quote.rate) : null,
    };

    const signup = existing
      ? await this.prisma.presencialSignup.update({
          where: { id: existing.id },
          data: depositData,
        })
      : await this.prisma.presencialSignup.create({
          data: {
            classId,
            userId,
            status: PresencialSignupStatus.PENDING,
            ...depositData,
          },
        });

    const preference = await this.createPreference({
      signupId: signup.id,
      userId,
      email: user.email,
      title: `Seña · ${quote.priceName}`,
      amountARS: quote.amountARS,
    });

    await this.prisma.presencialSignup.update({
      where: { id: signup.id },
      data: { mpPreferenceId: preference.id },
    });

    return {
      signupId: signup.id,
      preferenceId: preference.id,
      initPoint: preference.init_point,
      sandboxInitPoint: preference.sandbox_init_point,
      amountARS: quote.amountARS,
      amountUSD: quote.amountUSD,
      rate: quote.rate,
    };
  }

  private async createPreference(params: {
    signupId: string;
    userId: string;
    email: string;
    title: string;
    amountARS: number;
  }): Promise<{ id: string; init_point: string; sandbox_init_point?: string }> {
    const backUrl = `${this.frontendUrl}/es/presencialidad`;
    const body = {
      items: [
        {
          id: params.signupId,
          title: params.title,
          quantity: 1,
          unit_price: params.amountARS,
          currency_id: 'ARS',
        },
      ],
      payer: { email: params.email },
      // El webhook distingue por metadata.type: sin esto lo trataría como una
      // compra de cursos y buscaría category_ids.
      metadata: {
        type: 'presencial_deposit',
        signup_id: params.signupId,
        user_id: params.userId,
      },
      external_reference: `presencial_${params.signupId}`,
      back_urls: {
        success: backUrl,
        failure: backUrl,
        pending: backUrl,
      },
      auto_return: 'approved',
      ...(this.webhookUrl ? { notification_url: this.webhookUrl } : {}),
    };

    try {
      const { data } = await axios.post(MP_PREFERENCES_URL, body, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        timeout: REQUEST_TIMEOUT_MS,
      });
      return data as {
        id: string;
        init_point: string;
        sandbox_init_point?: string;
      };
    } catch (err) {
      this.logger.error(
        `No se pudo crear la preference de la seña ${params.signupId}: ${(err as Error).message}`,
      );
      throw new BadRequestException(
        'No pudimos iniciar el pago. Probá de nuevo en unos minutos.',
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Webhook
  // ---------------------------------------------------------------------------

  /** Marca la seña como pagada. Idempotente por mpPaymentId. */
  async markPaid(signupId: string, paymentId: string): Promise<boolean> {
    const { count } = await this.prisma.presencialSignup.updateMany({
      where: { id: signupId, depositStatus: { not: PresencialDepositStatus.PAID } },
      data: {
        depositStatus: PresencialDepositStatus.PAID,
        mpPaymentId: paymentId,
        depositPaidAt: new Date(),
      },
    });
    if (count === 0) {
      this.logger.warn(`Seña ${signupId} ya estaba paga (pago ${paymentId})`);
      return false;
    }
    this.logger.log(`✅ Seña ${signupId} pagada (pago ${paymentId})`);
    return true;
  }

  async markFailed(signupId: string, paymentId: string): Promise<void> {
    await this.prisma.presencialSignup.updateMany({
      where: { id: signupId, depositStatus: PresencialDepositStatus.PENDING },
      data: {
        depositStatus: PresencialDepositStatus.FAILED,
        mpPaymentId: paymentId,
      },
    });
  }
}
