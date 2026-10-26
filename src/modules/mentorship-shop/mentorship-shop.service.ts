import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MentorshipOrderStatus,
  MentorshipPaymentMethod,
  MentorshipProductType,
  Prisma,
} from '@prisma/client';
import axios from 'axios';
import { PrismaService } from '../../shared/services';
import { NotificationsService } from '../notifications/notifications.service';
import { SettingsService } from '../settings/settings.service';
import { SHOP_GIFTS_ENABLED_KEY } from '../settings/setting-definitions';
import { StorageService } from '../storage/storage.service';
import { MentorshipWhatsappAlertService } from '../mentorship/mentorship-whatsapp-alert.service';
import type { MercadoPagoPaymentDto } from '../mercadopago/dto';
import {
  promoLabel,
  promoRuleError,
  quoteCart,
  type PricedLine,
  type PromoRule,
  type ShopCurrency,
} from './shop-pricing';
import type {
  CartLineDto,
  CreateOrderDto,
  CreatePackDto,
  ListOrdersQueryDto,
  PromoDto,
  QuoteDto,
  ShopProductDto,
  UpdatePackDto,
} from './dto';

const MP_PREFERENCES_URL = 'https://api.mercadopago.com/checkout/preferences';
const REQUEST_TIMEOUT_MS = 15_000;
/** Vigencia de un crédito comprado en la tienda. */
const CREDIT_VALID_DAYS = 365;
/** Vigencia del link de pago de Mercado Pago (se puede regenerar). */
const PREFERENCE_VALID_HOURS = 24;
/** Tope de órdenes pendientes por alumna (evita llenar el panel de basura). */
const MAX_PENDING_ORDERS = 5;
const ORDERS_PAGE_SIZE = 20;
const DAY_MS = 24 * 60 * 60 * 1000;
const IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

const METHOD_CURRENCY: Record<MentorshipPaymentMethod, ShopCurrency> = {
  MERCADOPAGO: 'ARS',
  TRANSFER: 'ARS',
  CASH: 'ARS',
  FOREIGN: 'USD',
};

export const METHOD_LABEL: Record<MentorshipPaymentMethod, string> = {
  MERCADOPAGO: 'Mercado Pago',
  TRANSFER: 'Transferencia',
  CASH: 'Efectivo',
  FOREIGN: 'Pago desde el exterior (USD)',
};

/** Lo que da UNA unidad de un renglón (se guarda en OrderItem.contents). */
type ItemContent = {
  productId: string;
  name: string;
  type: MentorshipProductType;
  categoryId: string | null;
  quantity: number;
};

type ResolvedLine = PricedLine & { contents: ItemContent[] };

const dec = (n: number | null | undefined) =>
  n == null ? null : new Prisma.Decimal(n);
const num = (d: Prisma.Decimal | null | undefined) =>
  d == null ? null : Number(d);

function formatMoney(amount: number, currency: string) {
  return currency === 'USD'
    ? `USD ${amount.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
    : `$ ${amount.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;
}

const orderInclude = {
  items: { orderBy: { id: 'asc' } },
  user: { select: { id: true, email: true, firstName: true, lastName: true } },
  _count: { select: { credits: true } },
} satisfies Prisma.MentorshipOrderInclude;

type OrderWithItems = Prisma.MentorshipOrderGetPayload<{
  include: typeof orderInclude;
}>;

@Injectable()
export class MentorshipShopService {
  private readonly logger = new Logger(MentorshipShopService.name);
  private readonly accessToken: string;
  private readonly frontendUrl: string;
  private readonly webhookUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly settings: SettingsService,
    private readonly notifications: NotificationsService,
    private readonly storage: StorageService,
    private readonly whatsapp: MentorshipWhatsappAlertService,
  ) {
    this.accessToken = this.config.get<string>('MP_ACCESS_TOKEN') || '';
    // La tienda vive en un front aparte mientras está en prueba: los links de
    // vuelta de MP y los avisos apuntan ahí.
    this.frontendUrl = (
      this.config.get<string>('SHOP_FRONTEND_URL') ||
      this.config.get<string>('FRONTEND_URL') ||
      ''
    ).replace(/\/$/, '');
    this.webhookUrl = this.config.get<string>('MP_WEBHOOK_URL') || '';
  }

  // ===========================================================================
  // Catálogo
  // ===========================================================================

  async catalog() {
    const [products, packs, promos, giftsEnabled] = await Promise.all([
      this.prisma.mentorshipProduct.findMany({
        where: { isActive: true, shopEnabled: true },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        include: { category: { select: { id: true, name: true, slug: true } } },
      }),
      this.prisma.mentorshipPack.findMany({
        where: { isActive: true },
        orderBy: [
          { featured: 'desc' },
          { sortOrder: 'asc' },
          { createdAt: 'asc' },
        ],
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  type: true,
                  isActive: true,
                  shopEnabled: true,
                  shopPriceARS: true,
                  shopPriceUSD: true,
                },
              },
            },
          },
        },
      }),
      this.activePromos(),
      this.settings.getBoolean(SHOP_GIFTS_ENABLED_KEY),
    ]);

    return {
      products: products
        .filter((p) => p.shopPriceARS != null || p.shopPriceUSD != null)
        .map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          tagline: p.shopTagline,
          imageUrl: p.shopImageUrl,
          durationMin: p.shopDurationMin,
          type: p.type,
          category: p.category,
          priceARS: num(p.shopPriceARS),
          priceUSD: num(p.shopPriceUSD),
        })),
      packs: packs
        .filter(
          (p) =>
            (p.priceARS != null || p.priceUSD != null) &&
            p.items.length > 0 &&
            p.items.every((i) => i.product.isActive),
        )
        .map((p) => {
          // "Antes": lo que costarían las mentorías sueltas, si todas se venden sueltas.
          const compare = (key: 'shopPriceARS' | 'shopPriceUSD') =>
            p.items.every(
              (i) => i.product.shopEnabled && i.product[key] != null,
            )
              ? p.items.reduce(
                  (s, i) => s + Number(i.product[key]) * i.quantity,
                  0,
                )
              : null;
          return {
            id: p.id,
            name: p.name,
            description: p.description,
            tagline: p.tagline,
            imageUrl: p.imageUrl,
            featured: p.featured,
            priceARS: num(p.priceARS),
            priceUSD: num(p.priceUSD),
            compareARS: compare('shopPriceARS'),
            compareUSD: compare('shopPriceUSD'),
            items: p.items.map((i) => ({
              productId: i.product.id,
              name: i.product.name,
              type: i.product.type,
              quantity: i.quantity,
            })),
          };
        }),
      // Solo las automáticas: las de código no se publican.
      promos: promos
        .filter((p) => !p.code)
        .map((p) => ({
          id: p.id,
          name: p.name,
          kind: p.kind,
          label: promoLabel(p),
          appliesToAll: p.appliesToAll,
          productIds: p.productIds,
          validTo: p.validTo,
        })),
      giftsEnabled,
    };
  }

  /** Promos vigentes (activas, en fecha y con cupo). */
  private async activePromos(): Promise<
    (PromoRule & { validTo: Date | null })[]
  > {
    const now = new Date();
    const promos = await this.prisma.mentorshipPromo.findMany({
      where: {
        isActive: true,
        AND: [
          { OR: [{ validFrom: null }, { validFrom: { lte: now } }] },
          { OR: [{ validTo: null }, { validTo: { gte: now } }] },
        ],
      },
      orderBy: { createdAt: 'asc' },
      include: {
        products: { select: { productId: true } },
        _count: {
          select: { orders: { where: { status: MentorshipOrderStatus.PAID } } },
        },
      },
    });
    return promos
      .filter((p) => p.maxUses == null || p._count.orders < p.maxUses)
      .filter((p) => !promoRuleError(p))
      .map((p) => ({
        id: p.id,
        name: p.name,
        kind: p.kind,
        buyQty: p.buyQty,
        payQty: p.payQty,
        percent: p.percent,
        appliesToAll: p.appliesToAll,
        productIds: p.products.map((x) => x.productId),
        code: p.code,
        validTo: p.validTo,
      }));
  }

  // ===========================================================================
  // Cotización
  // ===========================================================================

  /** Resuelve el carrito contra la base: precios y contenido salen de acá. */
  private async resolveLines(
    lines: CartLineDto[],
    currency: ShopCurrency,
  ): Promise<ResolvedLine[]> {
    const merged = new Map<string, CartLineDto>();
    for (const l of lines) {
      const key = `${l.kind}:${l.id}`;
      const prev = merged.get(key);
      merged.set(key, {
        ...l,
        quantity: Math.min(10, (prev?.quantity ?? 0) + l.quantity),
      });
    }
    const wanted = [...merged.values()];
    const productIds = wanted
      .filter((l) => l.kind === 'PRODUCT')
      .map((l) => l.id);
    const packIds = wanted.filter((l) => l.kind === 'PACK').map((l) => l.id);

    const [products, packs] = await Promise.all([
      this.prisma.mentorshipProduct.findMany({
        where: { id: { in: productIds }, isActive: true, shopEnabled: true },
      }),
      this.prisma.mentorshipPack.findMany({
        where: { id: { in: packIds }, isActive: true },
        include: { items: { include: { product: true } } },
      }),
    ]);
    const productById = new Map(products.map((p) => [p.id, p]));
    const packById = new Map(packs.map((p) => [p.id, p]));
    const priceKey = currency === 'ARS' ? 'ARS' : 'USD';

    return wanted.map((l): ResolvedLine => {
      if (l.kind === 'PRODUCT') {
        const p = productById.get(l.id);
        if (!p)
          throw new BadRequestException(
            'Una de las mentorías ya no está disponible. Actualizá la página.',
          );
        const price = num(p[`shopPrice${priceKey}`]);
        if (price == null) {
          throw new BadRequestException(
            `"${p.name}" no se puede pagar en ${currency}.`,
          );
        }
        return {
          kind: 'PRODUCT',
          id: p.id,
          name: p.name,
          quantity: l.quantity,
          unitPrice: price,
          contents: [
            {
              productId: p.id,
              name: p.name,
              type: p.type,
              categoryId: p.categoryId,
              quantity: 1,
            },
          ],
        };
      }
      const pack = packById.get(l.id);
      if (
        !pack ||
        pack.items.length === 0 ||
        pack.items.some((i) => !i.product.isActive)
      ) {
        throw new BadRequestException(
          'Uno de los packs ya no está disponible. Actualizá la página.',
        );
      }
      const price = num(pack[`price${priceKey}`]);
      if (price == null) {
        throw new BadRequestException(
          `"${pack.name}" no se puede pagar en ${currency}.`,
        );
      }
      return {
        kind: 'PACK',
        id: pack.id,
        name: pack.name,
        quantity: l.quantity,
        unitPrice: price,
        contents: pack.items.map((i) => ({
          productId: i.product.id,
          name: i.product.name,
          type: i.product.type,
          categoryId: i.product.categoryId,
          quantity: i.quantity,
        })),
      };
    });
  }

  private async computeQuote(dto: QuoteDto) {
    const currency = METHOD_CURRENCY[dto.paymentMethod];
    const lines = await this.resolveLines(dto.lines, currency);
    const promos = await this.activePromos();
    const code = dto.code?.trim().toUpperCase() || null;
    const codePromo = code ? promos.find((p) => p.code === code) : undefined;
    const candidates = promos.filter(
      (p) => !p.code || (code && p.code === code),
    );
    const quote = quoteCart(lines, candidates, currency);

    let codeStatus: {
      status: 'applied' | 'invalid' | 'not_applied';
      message: string;
    } | null = null;
    if (code) {
      if (!codePromo) {
        codeStatus = {
          status: 'invalid',
          message: 'El código no existe o ya venció.',
        };
      } else if (quote.promo?.id === codePromo.id) {
        codeStatus = {
          status: 'applied',
          message: `Código aplicado: ${codePromo.name}`,
        };
      } else {
        codeStatus = {
          status: 'not_applied',
          message: quote.promo
            ? 'Ya tenés aplicada una promo que te conviene más.'
            : 'El código no aplica a estas mentorías.',
        };
      }
    }
    return { quote, lines, codeStatus };
  }

  async quote(dto: QuoteDto) {
    const { quote, codeStatus } = await this.computeQuote(dto);
    return { ...quote, paymentMethod: dto.paymentMethod, code: codeStatus };
  }

  // ===========================================================================
  // Órdenes (alumna)
  // ===========================================================================

  async createOrder(userId: string, dto: CreateOrderDto) {
    const { quote, lines, codeStatus } = await this.computeQuote(dto);
    if (codeStatus?.status === 'invalid') {
      throw new BadRequestException(codeStatus.message);
    }
    const pending = await this.prisma.mentorshipOrder.count({
      where: { userId, status: MentorshipOrderStatus.PENDING },
    });
    if (pending >= MAX_PENDING_ORDERS) {
      throw new BadRequestException(
        'Tenés varias compras pendientes. Cancelá las que no vayas a pagar desde "Mis mentorías".',
      );
    }
    const isMp = dto.paymentMethod === MentorshipPaymentMethod.MERCADOPAGO;
    if (isMp && quote.total > 0 && !this.accessToken) {
      throw new BadRequestException(
        'Mercado Pago no está disponible en este momento. Elegí otro medio de pago.',
      );
    }

    const order = await this.prisma.mentorshipOrder.create({
      data: {
        userId,
        paymentMethod: dto.paymentMethod,
        currency: quote.currency,
        subtotal: new Prisma.Decimal(quote.subtotal),
        discount: new Prisma.Decimal(quote.discount),
        total: new Prisma.Decimal(quote.total),
        promoId: quote.promo?.id ?? null,
        promoLabel: quote.promo
          ? `${quote.promo.name} (${quote.promo.label})`
          : null,
        items: {
          create: quote.lines.map((l, i) => ({
            kind: l.kind,
            productId: l.kind === 'PRODUCT' ? l.id : null,
            packId: l.kind === 'PACK' ? l.id : null,
            name: l.name,
            quantity: l.quantity,
            unitPrice: new Prisma.Decimal(l.unitPrice),
            lineTotal: new Prisma.Decimal(l.lineTotal),
            contents: lines[i].contents as unknown as Prisma.InputJsonValue,
          })),
        },
      },
      include: orderInclude,
    });

    // Una promo del 100% no pasa por ningún cobro.
    if (quote.total === 0) {
      await this.markPaid(order.id, { note: 'Total $0 (promo)' });
      return {
        order: await this.serializeOrderFor(userId, order.id),
        initPoint: null,
      };
    }

    if (isMp) {
      const initPoint = await this.attachPreference(order);
      return { order: this.serializeOrder(order), initPoint };
    }

    void this.alertOwner(order, 'nueva');
    void this.notifications.notifyAdmins({
      type: 'mentorship_order_pending',
      title: `Compra de mentorías #${order.number} para validar`,
      body: `${this.studentName(order.user)} · ${formatMoney(quote.total, quote.currency)} · ${METHOD_LABEL[order.paymentMethod]}`,
      url: '/es/admin/tienda-mentorias',
      data: { orderId: order.id },
    });
    return { order: this.serializeOrder(order), initPoint: null };
  }

  /** Regenera el link de pago de una orden de MP pendiente. */
  async payOrder(userId: string, orderId: string) {
    const order = await this.prisma.mentorshipOrder.findFirst({
      where: { id: orderId, userId },
      include: orderInclude,
    });
    if (!order) throw new NotFoundException('Compra no encontrada');
    if (order.status !== MentorshipOrderStatus.PENDING) {
      throw new BadRequestException(
        'Esta compra ya no está pendiente de pago.',
      );
    }
    if (order.paymentMethod !== MentorshipPaymentMethod.MERCADOPAGO) {
      throw new BadRequestException(
        'Esta compra se paga por fuera de Mercado Pago.',
      );
    }
    return { initPoint: await this.attachPreference(order) };
  }

  async cancelOrder(userId: string, orderId: string) {
    const { count } = await this.prisma.mentorshipOrder.updateMany({
      where: { id: orderId, userId, status: MentorshipOrderStatus.PENDING },
      data: { status: MentorshipOrderStatus.CANCELLED },
    });
    if (count === 0)
      throw new BadRequestException('Esta compra ya no se puede cancelar.');
    return this.serializeOrderFor(userId, orderId);
  }

  async myOrder(userId: string, orderId: string) {
    return this.serializeOrderFor(userId, orderId);
  }

  /** Créditos de la tienda + órdenes de la alumna (pantalla "Mis mentorías"). */
  async myShop(userId: string) {
    const [credits, orders, giftsEnabled] = await Promise.all([
      this.prisma.mentorshipCredit.findMany({
        where: { userId, orderId: { not: null } },
        orderBy: { createdAt: 'desc' },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              shopImageUrl: true,
              shopDurationMin: true,
            },
          },
          order: { select: { number: true } },
        },
      }),
      this.prisma.mentorshipOrder.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: orderInclude,
      }),
      this.settings.getBoolean(SHOP_GIFTS_ENABLED_KEY),
    ]);

    const categoryIds = [
      ...new Set(credits.map((c) => c.categoryId).filter(Boolean)),
    ] as string[];
    const mentorshipIds = credits
      .map((c) => c.mentorshipId)
      .filter(Boolean) as string[];
    const giverIds = [
      ...new Set(credits.map((c) => c.giftedFromUserId).filter(Boolean)),
    ] as string[];
    const [categories, mentorships, givers] = await Promise.all([
      this.prisma.videoCategory.findMany({
        where: { id: { in: categoryIds } },
        select: { id: true, name: true, slug: true },
      }),
      this.prisma.mentorship.findMany({ where: { id: { in: mentorshipIds } } }),
      this.prisma.user.findMany({
        where: { id: { in: giverIds } },
        select: { id: true, firstName: true, lastName: true, email: true },
      }),
    ]);
    const categoryById = new Map(categories.map((c) => [c.id, c]));
    const mentorshipById = new Map(mentorships.map((m) => [m.id, m]));
    const giverById = new Map(givers.map((g) => [g.id, g]));
    const now = Date.now();

    return {
      giftsEnabled,
      credits: credits.map((c) => {
        const m = c.mentorshipId
          ? mentorshipById.get(c.mentorshipId)
          : undefined;
        const expired =
          c.status === 'AVAILABLE' &&
          !!c.expiresAt &&
          c.expiresAt.getTime() < now;
        const giver = c.giftedFromUserId
          ? giverById.get(c.giftedFromUserId)
          : undefined;
        return {
          id: c.id,
          status: expired ? 'EXPIRED' : c.status,
          type: c.type,
          product: c.product
            ? {
                id: c.product.id,
                name: c.product.name,
                imageUrl: c.product.shopImageUrl,
                durationMin: c.product.shopDurationMin,
              }
            : null,
          category: c.categoryId
            ? (categoryById.get(c.categoryId) ?? null)
            : null,
          expiresAt: c.expiresAt?.toISOString() ?? null,
          createdAt: c.createdAt.toISOString(),
          orderNumber: c.order?.number ?? null,
          giftedFrom: giver ? this.studentName(giver) : null,
          mentorship: m
            ? {
                id: m.id,
                status: m.status,
                scheduledStart: m.scheduledStart.toISOString(),
                scheduledEnd: m.scheduledEnd.toISOString(),
                meetLink: m.googleMeetLink,
                canReschedule:
                  m.status === 'SCHEDULED' && m.rescheduleCount < 1,
              }
            : null,
        };
      }),
      orders: orders.map((o) => this.serializeOrder(o)),
    };
  }

  // ===========================================================================
  // Regalo de créditos (apagado por setting)
  // ===========================================================================

  async giftCredit(userId: string, creditId: string, email: string) {
    if (!(await this.settings.getBoolean(SHOP_GIFTS_ENABLED_KEY))) {
      throw new ForbiddenException(
        'Regalar mentorías todavía no está disponible.',
      );
    }
    const recipient = await this.prisma.user.findFirst({
      where: {
        email: { equals: email.trim(), mode: 'insensitive' },
        isActive: true,
        deletedAt: null,
      },
      select: { id: true, firstName: true, lastName: true, email: true },
    });
    if (!recipient) {
      throw new NotFoundException(
        'No hay una cuenta con ese email. Pedile que se registre primero.',
      );
    }
    if (recipient.id === userId) {
      throw new BadRequestException(
        'No podés regalarte una mentoría a vos misma.',
      );
    }
    const now = new Date();
    const { count } = await this.prisma.mentorshipCredit.updateMany({
      where: {
        id: creditId,
        userId,
        status: 'AVAILABLE',
        orderId: { not: null },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      data: { userId: recipient.id, giftedFromUserId: userId, giftedAt: now },
    });
    if (count === 0) {
      throw new BadRequestException('Esta mentoría ya no se puede regalar.');
    }
    const [giver, credit] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { firstName: true, lastName: true, email: true },
      }),
      this.prisma.mentorshipCredit.findUnique({
        where: { id: creditId },
        include: { product: { select: { name: true } } },
      }),
    ]);
    void this.notifications.notify(recipient.id, {
      type: 'mentorship_credit_gifted',
      title: `${giver ? this.studentName(giver) : 'Alguien'} te regaló una mentoría`,
      body: credit?.product?.name ?? 'Entrá a "Mis mentorías" para reservarla.',
      url: '/es/mentorias/mis-mentorias',
      data: { creditId },
    });
    return { gifted: true, recipient: this.studentName(recipient) };
  }

  // ===========================================================================
  // Pago confirmado (webhook de MP o validación manual)
  // ===========================================================================

  /**
   * Marca la orden como pagada y otorga los créditos, todo en una transacción.
   * Idempotente: si ya estaba pagada no vuelve a otorgar nada (devuelve false).
   */
  async markPaid(
    orderId: string,
    opts: { mpPaymentId?: string; reviewedById?: string; note?: string } = {},
  ): Promise<boolean> {
    const now = new Date();
    const granted = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.mentorshipOrder.updateMany({
        where: { id: orderId, status: { not: MentorshipOrderStatus.PAID } },
        data: {
          status: MentorshipOrderStatus.PAID,
          paidAt: now,
          ...(opts.mpPaymentId ? { mpPaymentId: opts.mpPaymentId } : {}),
          ...(opts.reviewedById
            ? { reviewedById: opts.reviewedById, reviewedAt: now }
            : {}),
          ...(opts.note ? { adminNote: opts.note } : {}),
        },
      });
      if (count === 0) return false;
      const order = await tx.mentorshipOrder.findUniqueOrThrow({
        where: { id: orderId },
        include: { items: true },
      });
      const expiresAt = new Date(now.getTime() + CREDIT_VALID_DAYS * DAY_MS);
      const data: Prisma.MentorshipCreditCreateManyInput[] = [];
      for (const item of order.items) {
        const contents = item.contents as unknown as ItemContent[];
        for (let u = 0; u < item.quantity; u++) {
          for (const c of contents) {
            for (let k = 0; k < c.quantity; k++) {
              data.push({
                userId: order.userId,
                productId: c.productId,
                categoryId: c.categoryId,
                type: c.type,
                currency: order.currency,
                note: `Tienda · compra #${order.number}`,
                grantedById: opts.reviewedById ?? null,
                orderId: order.id,
                expiresAt,
              });
            }
          }
        }
      }
      if (data.length) await tx.mentorshipCredit.createMany({ data });
      return true;
    });
    if (!granted) {
      this.logger.warn(`Orden ${orderId} ya estaba pagada`);
      return false;
    }

    const order = await this.prisma.mentorshipOrder.findUnique({
      where: { id: orderId },
      include: orderInclude,
    });
    if (order) {
      this.logger.log(
        `✅ Orden de mentorías #${order.number} pagada (${order._count.credits} créditos)`,
      );
      void this.notifications.notify(order.userId, {
        type: 'mentorship_order_paid',
        title: '¡Tu compra está confirmada!',
        body:
          order._count.credits === 1
            ? 'Ya podés reservar tu mentoría.'
            : `Ya podés reservar tus ${order._count.credits} mentorías.`,
        url: '/es/mentorias/mis-mentorias',
        data: { orderId: order.id },
      });
      if (opts.mpPaymentId) void this.alertOwner(order, 'pagada');
    }
    return true;
  }

  /**
   * Pago aprobado de MP con metadata.type = 'mentorship_order'. El pago ya se
   * leyó de la API de MP (no del body del webhook): acá se cruza con la orden.
   */
  async handleMpApproved(payment: MercadoPagoPaymentDto): Promise<void> {
    const paymentId = String(payment.id);
    const orderId =
      (payment.metadata?.order_id as string | undefined) ||
      payment.external_reference?.replace(/^mentorship_order_/, '');
    if (!orderId) {
      this.logger.error(`❌ Pago ${paymentId} de mentorías sin order_id`);
      return;
    }
    const order = await this.prisma.mentorshipOrder.findUnique({
      where: { id: orderId },
      include: orderInclude,
    });
    if (!order) {
      this.logger.error(`❌ Pago ${paymentId}: la orden ${orderId} no existe`);
      return;
    }
    if (order.status === MentorshipOrderStatus.PAID) {
      this.logger.log(
        `⏭️ Orden #${order.number} ya pagada (pago ${paymentId})`,
      );
      return;
    }

    const total = Number(order.total);
    const paid = Number(payment.transaction_amount);
    const metaUser = payment.metadata?.user_id;
    const problems: string[] = [];
    if (payment.currency_id !== 'ARS' || order.currency !== 'ARS')
      problems.push('moneda');
    if (!(paid + 0.01 >= total)) problems.push(`monto ${paid} < ${total}`);
    if (metaUser && metaUser !== order.userId) problems.push('usuaria');
    if (problems.length) {
      const note = `⚠️ Pago MP ${paymentId} no coincide (${problems.join(', ')}). Revisar antes de aprobar.`;
      this.logger.error(`❌ Orden #${order.number}: ${note}`);
      await this.prisma.mentorshipOrder.update({
        where: { id: order.id },
        data: { adminNote: note },
      });
      void this.whatsapp.sendText(
        `⚠️ *Pago de mentorías que no coincide* · compra #${order.number}\n${this.studentName(order.user)}\n${note}`,
      );
      return;
    }

    try {
      await this.markPaid(order.id, { mpPaymentId: paymentId });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        this.logger.error(
          `❌ Pago ${paymentId} ya estaba asociado a otra orden`,
        );
        return;
      }
      throw err;
    }
  }

  // ===========================================================================
  // Admin
  // ===========================================================================

  listProductsAdmin() {
    return this.prisma.mentorshipProduct
      .findMany({
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        include: { category: { select: { id: true, name: true, slug: true } } },
      })
      .then((ps) =>
        ps.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          type: p.type,
          isActive: p.isActive,
          category: p.category,
          shopEnabled: p.shopEnabled,
          shopOnly: p.shopOnly,
          shopPriceARS: num(p.shopPriceARS),
          shopPriceUSD: num(p.shopPriceUSD),
          shopTagline: p.shopTagline,
          shopImageUrl: p.shopImageUrl,
          shopDurationMin: p.shopDurationMin,
        })),
      );
  }

  async updateProductShop(id: string, dto: ShopProductDto) {
    const product = await this.prisma.mentorshipProduct.findUnique({
      where: { id },
    });
    if (!product) throw new NotFoundException('Producto no encontrado');
    const enabling = dto.shopEnabled ?? product.shopEnabled;
    if (enabling && product.type === 'MENTORSHIP' && !product.categoryId) {
      throw new BadRequestException(
        'Asigná el curso a esta mentoría antes de publicarla: la reserva se hace por curso.',
      );
    }
    const priceARS =
      dto.shopPriceARS !== undefined
        ? dto.shopPriceARS
        : num(product.shopPriceARS);
    const priceUSD =
      dto.shopPriceUSD !== undefined
        ? dto.shopPriceUSD
        : num(product.shopPriceUSD);
    if (enabling && priceARS == null && priceUSD == null) {
      throw new BadRequestException(
        'Cargá al menos un precio (pesos o dólares) para publicarla.',
      );
    }
    await this.prisma.mentorshipProduct.update({
      where: { id },
      data: {
        ...(dto.shopEnabled !== undefined
          ? { shopEnabled: dto.shopEnabled }
          : {}),
        ...(dto.shopOnly !== undefined ? { shopOnly: dto.shopOnly } : {}),
        ...(dto.shopPriceARS !== undefined
          ? { shopPriceARS: dec(dto.shopPriceARS) }
          : {}),
        ...(dto.shopPriceUSD !== undefined
          ? { shopPriceUSD: dec(dto.shopPriceUSD) }
          : {}),
        ...(dto.shopTagline !== undefined
          ? { shopTagline: dto.shopTagline?.trim() || null }
          : {}),
        ...(dto.shopImageUrl !== undefined
          ? { shopImageUrl: dto.shopImageUrl || null }
          : {}),
        ...(dto.shopDurationMin !== undefined
          ? { shopDurationMin: dto.shopDurationMin }
          : {}),
      },
    });
    return (await this.listProductsAdmin()).find((p) => p.id === id);
  }

  async uploadImage(
    file:
      | { buffer: Buffer; mimetype: string; originalname: string }
      | undefined,
  ) {
    if (!file?.buffer) throw new BadRequestException('Archivo inválido');
    if (!IMAGE_MIMES.includes(file.mimetype)) {
      throw new BadRequestException('Formato no permitido (solo PNG/JPG/WEBP)');
    }
    return this.storage.uploadBuffer({
      buffer: file.buffer,
      contentType: file.mimetype,
      originalName: file.originalname,
      folder: 'mentorship-shop',
    });
  }

  // ----- Packs -----

  private packInclude = {
    items: {
      include: {
        product: {
          select: { id: true, name: true, type: true, isActive: true },
        },
      },
    },
  } satisfies Prisma.MentorshipPackInclude;

  private serializePack(
    p: Prisma.MentorshipPackGetPayload<{
      include: MentorshipShopService['packInclude'];
    }>,
  ) {
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      tagline: p.tagline,
      imageUrl: p.imageUrl,
      priceARS: num(p.priceARS),
      priceUSD: num(p.priceUSD),
      isActive: p.isActive,
      featured: p.featured,
      sortOrder: p.sortOrder,
      items: p.items.map((i) => ({
        productId: i.productId,
        name: i.product.name,
        type: i.product.type,
        isActive: i.product.isActive,
        quantity: i.quantity,
      })),
    };
  }

  async listPacks() {
    const packs = await this.prisma.mentorshipPack.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: this.packInclude,
    });
    return packs.map((p) => this.serializePack(p));
  }

  private async validatePackItems(
    items: { productId: string; quantity: number }[],
  ) {
    const ids = [...new Set(items.map((i) => i.productId))];
    if (ids.length !== items.length) {
      throw new BadRequestException(
        'Hay mentorías repetidas en el pack: usá la cantidad.',
      );
    }
    const products = await this.prisma.mentorshipProduct.findMany({
      where: { id: { in: ids } },
    });
    if (products.length !== ids.length)
      throw new BadRequestException('Alguna mentoría del pack no existe');
    const orphan = products.find(
      (p) => p.type === 'MENTORSHIP' && !p.categoryId,
    );
    if (orphan) {
      throw new BadRequestException(
        `"${orphan.name}" no tiene curso asignado: no se podría reservar.`,
      );
    }
  }

  private assertPackPrice(
    priceARS: number | null | undefined,
    priceUSD: number | null | undefined,
  ) {
    if (priceARS == null && priceUSD == null) {
      throw new BadRequestException(
        'Cargá al menos un precio (pesos o dólares).',
      );
    }
  }

  async createPack(dto: CreatePackDto) {
    this.assertPackPrice(dto.priceARS, dto.priceUSD);
    await this.validatePackItems(dto.items);
    const pack = await this.prisma.mentorshipPack.create({
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        tagline: dto.tagline?.trim() || null,
        imageUrl: dto.imageUrl || null,
        priceARS: dec(dto.priceARS),
        priceUSD: dec(dto.priceUSD),
        isActive: dto.isActive ?? true,
        featured: dto.featured ?? false,
        sortOrder: dto.sortOrder ?? 0,
        items: {
          create: dto.items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
          })),
        },
      },
      include: this.packInclude,
    });
    return this.serializePack(pack);
  }

  async updatePack(id: string, dto: UpdatePackDto) {
    const current = await this.prisma.mentorshipPack.findUnique({
      where: { id },
    });
    if (!current) throw new NotFoundException('Pack no encontrado');
    this.assertPackPrice(
      dto.priceARS !== undefined ? dto.priceARS : num(current.priceARS),
      dto.priceUSD !== undefined ? dto.priceUSD : num(current.priceUSD),
    );
    if (dto.items) await this.validatePackItems(dto.items);
    const pack = await this.prisma.$transaction(async (tx) => {
      if (dto.items) {
        await tx.mentorshipPackItem.deleteMany({ where: { packId: id } });
        await tx.mentorshipPackItem.createMany({
          data: dto.items.map((i) => ({
            packId: id,
            productId: i.productId,
            quantity: i.quantity,
          })),
        });
      }
      return tx.mentorshipPack.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.description !== undefined
            ? { description: dto.description?.trim() || null }
            : {}),
          ...(dto.tagline !== undefined
            ? { tagline: dto.tagline?.trim() || null }
            : {}),
          ...(dto.imageUrl !== undefined
            ? { imageUrl: dto.imageUrl || null }
            : {}),
          ...(dto.priceARS !== undefined
            ? { priceARS: dec(dto.priceARS) }
            : {}),
          ...(dto.priceUSD !== undefined
            ? { priceUSD: dec(dto.priceUSD) }
            : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
          ...(dto.featured !== undefined ? { featured: dto.featured } : {}),
          ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        },
        include: this.packInclude,
      });
    });
    return this.serializePack(pack);
  }

  async removePack(id: string) {
    const { count } = await this.prisma.mentorshipPack.deleteMany({
      where: { id },
    });
    if (count === 0) throw new NotFoundException('Pack no encontrado');
    return { deleted: true };
  }

  // ----- Promos -----

  private async serializePromos(where: Prisma.MentorshipPromoWhereInput = {}) {
    const promos = await this.prisma.mentorshipPromo.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        products: { select: { productId: true } },
        _count: {
          select: { orders: { where: { status: MentorshipOrderStatus.PAID } } },
        },
      },
    });
    return promos.map((p) => ({
      id: p.id,
      name: p.name,
      kind: p.kind,
      label: promoLabel(p),
      buyQty: p.buyQty,
      payQty: p.payQty,
      percent: p.percent,
      code: p.code,
      appliesToAll: p.appliesToAll,
      productIds: p.products.map((x) => x.productId),
      validFrom: p.validFrom?.toISOString() ?? null,
      validTo: p.validTo?.toISOString() ?? null,
      maxUses: p.maxUses,
      uses: p._count.orders,
      isActive: p.isActive,
    }));
  }

  listPromos() {
    return this.serializePromos();
  }

  private promoData(dto: PromoDto) {
    const kindFields =
      dto.kind === 'BUY_X_PAY_Y'
        ? {
            buyQty: dto.buyQty ?? null,
            payQty: dto.payQty ?? null,
            percent: null,
          }
        : { buyQty: null, payQty: null, percent: dto.percent ?? null };
    const err = promoRuleError({ kind: dto.kind, ...kindFields });
    if (err) throw new BadRequestException(err);
    const appliesToAll = dto.appliesToAll ?? true;
    const productIds = appliesToAll ? [] : [...new Set(dto.productIds ?? [])];
    if (!appliesToAll && productIds.length === 0) {
      throw new BadRequestException(
        'Elegí al menos una mentoría para la promo.',
      );
    }
    const validFrom = dto.validFrom ? new Date(dto.validFrom) : null;
    const validTo = dto.validTo ? new Date(dto.validTo) : null;
    if (validFrom && validTo && validFrom > validTo) {
      throw new BadRequestException(
        'La fecha de fin es anterior a la de inicio.',
      );
    }
    return {
      data: {
        name: dto.name.trim(),
        kind: dto.kind,
        ...kindFields,
        code: dto.code?.trim().toUpperCase() || null,
        appliesToAll,
        validFrom,
        validTo,
        maxUses: dto.maxUses ?? null,
        isActive: dto.isActive ?? true,
      },
      productIds,
    };
  }

  private rethrowPromoConflict(err: unknown): never {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      throw new ConflictException('Ya existe una promo con ese código.');
    }
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2003'
    ) {
      throw new BadRequestException('Alguna mentoría de la promo no existe.');
    }
    throw err;
  }

  async createPromo(dto: PromoDto) {
    const { data, productIds } = this.promoData(dto);
    try {
      const promo = await this.prisma.mentorshipPromo.create({
        data: {
          ...data,
          products: { create: productIds.map((productId) => ({ productId })) },
        },
      });
      return (await this.serializePromos({ id: promo.id }))[0];
    } catch (err) {
      this.rethrowPromoConflict(err);
    }
  }

  async updatePromo(id: string, dto: PromoDto) {
    const exists = await this.prisma.mentorshipPromo.findUnique({
      where: { id },
    });
    if (!exists) throw new NotFoundException('Promo no encontrada');
    const { data, productIds } = this.promoData(dto);
    try {
      await this.prisma.$transaction([
        this.prisma.mentorshipPromoProduct.deleteMany({
          where: { promoId: id },
        }),
        this.prisma.mentorshipPromo.update({
          where: { id },
          data: {
            ...data,
            products: {
              create: productIds.map((productId) => ({ productId })),
            },
          },
        }),
      ]);
    } catch (err) {
      this.rethrowPromoConflict(err);
    }
    return (await this.serializePromos({ id }))[0];
  }

  async removePromo(id: string) {
    const { count } = await this.prisma.mentorshipPromo.deleteMany({
      where: { id },
    });
    if (count === 0) throw new NotFoundException('Promo no encontrada');
    return { deleted: true };
  }

  // ----- Órdenes -----

  async listOrders(q: ListOrdersQueryDto) {
    const page = q.page ?? 1;
    const search = q.search?.trim();
    const number =
      search && /^#?\d+$/.test(search) ? Number(search.replace('#', '')) : null;
    const where: Prisma.MentorshipOrderWhereInput = {
      ...(q.status ? { status: q.status } : {}),
      ...(search
        ? {
            OR: [
              ...(number != null ? [{ number }] : []),
              { user: { email: { contains: search, mode: 'insensitive' } } },
              {
                user: { firstName: { contains: search, mode: 'insensitive' } },
              },
              { user: { lastName: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const [total, orders, pendingCount] = await Promise.all([
      this.prisma.mentorshipOrder.count({ where }),
      this.prisma.mentorshipOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * ORDERS_PAGE_SIZE,
        take: ORDERS_PAGE_SIZE,
        include: orderInclude,
      }),
      this.prisma.mentorshipOrder.count({
        where: { status: MentorshipOrderStatus.PENDING },
      }),
    ]);
    return {
      orders: orders.map((o) => this.serializeOrder(o, true)),
      total,
      page,
      pageSize: ORDERS_PAGE_SIZE,
      pendingCount,
    };
  }

  async approveOrder(orderId: string, adminId: string, note?: string) {
    const order = await this.prisma.mentorshipOrder.findUnique({
      where: { id: orderId },
    });
    if (!order) throw new NotFoundException('Compra no encontrada');
    if (order.status === MentorshipOrderStatus.PAID) {
      throw new BadRequestException('Esta compra ya está aprobada.');
    }
    await this.markPaid(orderId, {
      reviewedById: adminId,
      note: note?.trim() || undefined,
    });
    return this.adminOrder(orderId);
  }

  async rejectOrder(orderId: string, adminId: string, note?: string) {
    const { count } = await this.prisma.mentorshipOrder.updateMany({
      where: { id: orderId, status: MentorshipOrderStatus.PENDING },
      data: {
        status: MentorshipOrderStatus.REJECTED,
        reviewedById: adminId,
        reviewedAt: new Date(),
        adminNote: note?.trim() || null,
      },
    });
    if (count === 0)
      throw new BadRequestException(
        'Solo se pueden rechazar compras pendientes.',
      );
    const order = await this.adminOrder(orderId);
    void this.notifications.notify(order.user!.id, {
      type: 'mentorship_order_rejected',
      title: `No pudimos validar el pago de tu compra #${order.number}`,
      body: note?.trim() || 'Escribinos por WhatsApp y lo resolvemos.',
      url: '/es/mentorias/mis-mentorias',
      data: { orderId },
    });
    return order;
  }

  private async adminOrder(orderId: string) {
    const order = await this.prisma.mentorshipOrder.findUniqueOrThrow({
      where: { id: orderId },
      include: orderInclude,
    });
    return this.serializeOrder(order, true);
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  private async attachPreference(order: OrderWithItems): Promise<string> {
    const backUrl = `${this.frontendUrl}/es/mentorias/compra/${order.id}`;
    const now = new Date();
    const body = {
      items: [
        {
          id: order.id,
          title: `Mentorías Mery García · compra #${order.number}`,
          description: order.items
            .map((i) => `${i.quantity}× ${i.name}`)
            .join(', ')
            .slice(0, 250),
          quantity: 1,
          unit_price: Number(order.total),
          currency_id: 'ARS',
        },
      ],
      payer: { email: order.user.email },
      // El webhook distingue por metadata.type: sin esto lo trataría como una
      // compra de cursos y buscaría category_ids.
      metadata: {
        type: 'mentorship_order',
        order_id: order.id,
        user_id: order.userId,
      },
      external_reference: `mentorship_order_${order.id}`,
      back_urls: { success: backUrl, failure: backUrl, pending: backUrl },
      auto_return: 'approved',
      expires: true,
      expiration_date_from: now.toISOString(),
      expiration_date_to: new Date(
        now.getTime() + PREFERENCE_VALID_HOURS * 3600_000,
      ).toISOString(),
      ...(this.webhookUrl ? { notification_url: this.webhookUrl } : {}),
    };
    try {
      const { data } = await axios.post<{ id: string; init_point: string }>(
        MP_PREFERENCES_URL,
        body,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
          timeout: REQUEST_TIMEOUT_MS,
        },
      );
      await this.prisma.mentorshipOrder.update({
        where: { id: order.id },
        data: { mpPreferenceId: data.id },
      });
      return data.init_point;
    } catch (err) {
      this.logger.error(
        `No se pudo crear la preference de la orden #${order.number}: ${(err as Error).message}`,
      );
      throw new BadRequestException(
        'No pudimos iniciar el pago. Probá de nuevo en unos minutos (tu compra quedó guardada).',
      );
    }
  }

  private async alertOwner(order: OrderWithItems, kind: 'nueva' | 'pagada') {
    const lines = [
      kind === 'nueva'
        ? `🛍️ *Compra de mentorías #${order.number} para validar*`
        : `✅ *Compra de mentorías #${order.number} pagada por Mercado Pago*`,
      `${this.studentName(order.user)} — ${order.user.email}`,
      ...order.items.map((i) => `• ${i.quantity}× ${i.name}`),
      `💰 ${formatMoney(Number(order.total), order.currency)} · ${METHOD_LABEL[order.paymentMethod]}`,
    ];
    if (order.promoLabel) lines.push(`🏷️ ${order.promoLabel}`);
    if (kind === 'nueva')
      lines.push('', 'Aprobar en el panel: Tienda de mentorías → Compras.');
    await this.whatsapp
      .sendText(lines.join('\n'))
      .catch((err) =>
        this.logger.error('Aviso de compra al dueño falló', err as Error),
      );
  }

  private studentName(u: {
    firstName: string | null;
    lastName: string | null;
    email: string;
  }) {
    return (
      [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.email
    );
  }

  private async serializeOrderFor(userId: string, orderId: string) {
    const order = await this.prisma.mentorshipOrder.findFirst({
      where: { id: orderId, userId },
      include: orderInclude,
    });
    if (!order) throw new NotFoundException('Compra no encontrada');
    return this.serializeOrder(order);
  }

  private serializeOrder(o: OrderWithItems, admin = false) {
    return {
      id: o.id,
      number: o.number,
      status: o.status,
      paymentMethod: o.paymentMethod,
      paymentMethodLabel: METHOD_LABEL[o.paymentMethod],
      currency: o.currency,
      subtotal: Number(o.subtotal),
      discount: Number(o.discount),
      total: Number(o.total),
      promoLabel: o.promoLabel,
      createdAt: o.createdAt.toISOString(),
      paidAt: o.paidAt?.toISOString() ?? null,
      creditsCount: o._count.credits,
      items: o.items.map((i) => ({
        id: i.id,
        kind: i.kind,
        name: i.name,
        quantity: i.quantity,
        unitPrice: Number(i.unitPrice),
        lineTotal: Number(i.lineTotal),
        contents: (i.contents as unknown as ItemContent[]).map((c) => ({
          name: c.name,
          quantity: c.quantity,
          type: c.type,
        })),
      })),
      ...(admin
        ? {
            user: o.user,
            mpPaymentId: o.mpPaymentId,
            reviewedAt: o.reviewedAt?.toISOString() ?? null,
            adminNote: o.adminNote,
          }
        : {}),
    };
  }
}
