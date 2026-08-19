import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/services';
import { CouponsService } from '../coupons/coupons.service';
import { SettingsService } from '../settings/settings.service';

/** priceARS con este valor centinela marca un curso USD-only (no se paga por MP). */
const USD_ONLY_SENTINEL = 99999999;
/** Cupones que fuerzan el pago a máximo 2 cuotas (por ID, no por código). */
const FORCE_MAX_2_CUOTAS_COUPON_IDS = new Set<string>([]);
const ALLOWED_INSTALLMENTS = [2, 3, 6];
const DEFAULT_INSTALLMENTS = 6;

export interface QuoteItem {
  categoryId: string;
  title: string;
  description: string;
  unitPrice: number;
}

export interface QuoteResult {
  items: QuoteItem[];
  installments: number;
  couponId: string | null;
  couponCode: string | null;
  discountPercent: number;
  currency: 'ARS';
  subtotal: number;
  total: number;
}

/**
 * Autoridad de precios del checkout. Calcula los line-items desde la DB (nunca
 * confía en el precio que manda el cliente), valida el cupón server-side
 * (incluida la propiedad del cupón personal) y aplica las reglas de cuotas.
 */
@Injectable()
export class CheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly coupons: CouponsService,
    private readonly settings: SettingsService,
  ) {}

  /** Estado público de la promo global (para que el front la refleje). */
  async getPromo() {
    return this.settings.getCheckoutPromo();
  }

  async quote(params: {
    userId: string;
    categoryIds: string[];
    couponCode?: string;
    installments?: number;
  }): Promise<QuoteResult> {
    const { userId, couponCode } = params;
    const uniqueIds = Array.from(new Set(params.categoryIds));

    const cats = await this.prisma.videoCategory.findMany({
      where: { id: { in: uniqueIds }, isActive: true, deletedAt: null },
      select: { id: true, name: true, description: true, priceARS: true },
    });

    // Solo cursos en pesos: los USD-only no se cobran por Mercado Pago.
    const arsCats = cats.filter(
      (c) => Number(c.priceARS) !== USD_ONLY_SENTINEL,
    );
    if (arsCats.length === 0) {
      throw new BadRequestException(
        'No hay cursos en pesos para procesar por Mercado Pago',
      );
    }

    const promo = await this.settings.getCheckoutPromo();

    // Descuento: si hay cupón, manda el cupón (validado server-side). Si no hay
    // cupón y la promo global está activa, se aplica el descuento fijo a TODO.
    // No se acumulan (cupón y promo son excluyentes).
    let discountPercent = 0;
    let couponId: string | null = null;
    let couponCodeResolved: string | null = null;
    let applicable = new Set<string>();
    if (couponCode?.trim()) {
      const res = await this.coupons.validateCoupon(
        { code: couponCode.trim(), categoryIds: arsCats.map((c) => c.id) },
        userId,
      );
      if (!res.valid || !res.couponId) {
        throw new BadRequestException(res.message || 'Cupón no válido');
      }
      discountPercent = res.discountPercent;
      couponId = res.couponId;
      couponCodeResolved = res.couponCode;
      applicable = new Set(res.applicableCategoryIds);
    } else if (promo.active && promo.discountPercent > 0) {
      discountPercent = promo.discountPercent;
      applicable = new Set(arsCats.map((c) => c.id));
    }

    // Cuotas: con la promo activa se topea al máximo configurado. Sin promo,
    // algún cupón puede forzar 2; sino el plan pedido (2/3/6).
    const forceCouponTwo =
      !!couponId && FORCE_MAX_2_CUOTAS_COUPON_IDS.has(couponId);
    let installments = ALLOWED_INSTALLMENTS.includes(Number(params.installments))
      ? Number(params.installments)
      : DEFAULT_INSTALLMENTS;
    if (promo.active) {
      installments = Math.min(installments, promo.maxInstallments);
    } else if (forceCouponTwo) {
      installments = 2;
    }
    if (installments < 1) installments = 1;
    // El descuento del 10% aplica solo al plan de 3 cuotas (y nunca durante la promo).
    const cuotasFactor = !promo.active && installments === 3 ? 0.9 : 1;

    let subtotal = 0;
    let total = 0;
    const items: QuoteItem[] = arsCats.map((c) => {
      const list = Number(c.priceARS);
      subtotal += list;
      const couponFactor = applicable.has(c.id)
        ? 1 - discountPercent / 100
        : 1;
      const afterCoupon = Math.round(list * couponFactor);
      const unitPrice = Math.round(afterCoupon * cuotasFactor);
      total += unitPrice;
      return {
        categoryId: c.id,
        title: c.name,
        description: c.description || `Curso: ${c.name}`,
        unitPrice,
      };
    });

    return {
      items,
      installments,
      couponId,
      couponCode: couponCodeResolved,
      discountPercent,
      currency: 'ARS',
      subtotal,
      total,
    };
  }
}
