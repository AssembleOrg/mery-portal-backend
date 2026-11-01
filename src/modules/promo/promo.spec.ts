import { CouponsService } from '../coupons/coupons.service';
import { PromoCloseService } from './promo-close.service';

const coupon = {
  id: 'c1',
  code: 'NUEVA20-ABC',
  isActive: true,
  userId: 'u1',
  validFrom: null,
  validTo: null,
  maxUses: 1,
  currentUses: 0,
  appliesToAll: true,
  excludeOwnedCategories: false,
  discountPercent: 20,
  categories: [],
};

describe('cupones durante la promo', () => {
  const build = (onPromoIds: string[]) => {
    const prisma = {
      coupon: { findFirst: jest.fn().mockResolvedValue(coupon) },
      videoCategory: {
        findMany: jest.fn(({ where }) =>
          Promise.resolve(
            (where.id.in as string[]).filter((id) => onPromoIds.includes(id)).map((id) => ({ id })),
          ),
        ),
      },
      categoryPurchase: { findMany: jest.fn().mockResolvedValue([]) },
    };
    return new CouponsService(prisma as any);
  };

  it('no se aplica a un curso en promo', async () => {
    const res = await build(['lip']).validateCoupon({ code: coupon.code, categoryIds: ['lip'] }, 'u1');
    expect(res.valid).toBe(false);
    expect(res.message).toBe('Los cursos en promo no se combinan con cupones');
  });

  it('en un carrito mixto se aplica solo a los cursos sin promo', async () => {
    const res = await build(['lip']).validateCoupon(
      { code: coupon.code, categoryIds: ['lip', 'refill'] },
      'u1',
    );
    expect(res.valid).toBe(true);
    expect(res.applicableCategoryIds).toEqual(['refill']);
  });

  it('sin promo funciona como siempre', async () => {
    const res = await build([]).validateCoupon({ code: coupon.code, categoryIds: ['lip'] }, 'u1');
    expect(res.valid).toBe(true);
    expect(res.applicableCategoryIds).toEqual(['lip']);
  });
});

describe('cierre automático de la promo', () => {
  const CLOSE_AT = '2026-11-10T00:00:00-03:00';

  const build = (opts: { closeAt?: string; failTx?: boolean } = {}) => {
    const updates: any[] = [];
    const cartUpdates: any[] = [];
    const tx = {
      videoCategory: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'lip',
            name: 'Lipblush',
            priceARS: 360000,
            priceUSD: 300,
            originalPriceARS: 600000,
            originalPriceUSD: 500,
          },
          {
            id: 'nano',
            name: 'Nanoblading',
            priceARS: 99999999,
            priceUSD: 1380,
            originalPriceARS: null,
            originalPriceUSD: 2300,
          },
        ]),
        update: jest.fn((a) => updates.push(a)),
      },
      cartItem: { updateMany: jest.fn((a) => cartUpdates.push(a)) },
    };
    const prisma = {
      $transaction: jest.fn((fn) => (opts.failTx ? Promise.reject(new Error('db caída')) : fn(tx))),
    };
    let value = opts.closeAt ?? CLOSE_AT;
    const settings = {
      getString: jest.fn(() => Promise.resolve(value)),
      set: jest.fn((_k: string, v: string) => {
        value = v;
        return Promise.resolve();
      }),
    };
    const config = {
      get: jest.fn((k: string, d?: string) =>
        k === 'MENTORSHIP_ALERT_EMAILS' ? 'charly@example.com' : d,
      ),
    };
    const svc = new PromoCloseService(prisma as any, settings as any, config as any);
    const sent: any[] = [];
    (svc as any).api = { sendTransacEmail: jest.fn((e) => sent.push(e)) };
    return { svc, prisma, settings, updates, cartUpdates, sent };
  };

  it('antes de la hora no toca nada', async () => {
    const t = build();
    await t.svc.tick(new Date('2026-11-09T23:59:00-03:00'));
    expect(t.prisma.$transaction).not.toHaveBeenCalled();
    expect(t.sent).toHaveLength(0);
  });

  it('sin cierre programado no toca nada', async () => {
    const t = build({ closeAt: '' });
    await t.svc.tick(new Date('2026-12-01T00:00:00-03:00'));
    expect(t.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('a la hora restaura precios y carritos, limpia la setting y avisa', async () => {
    const t = build();
    await t.svc.tick(new Date('2026-11-10T00:00:30-03:00'));
    expect(t.updates).toEqual([
      {
        where: { id: 'lip' },
        data: { priceARS: 600000, priceUSD: 500, originalPriceARS: null, originalPriceUSD: null },
      },
      {
        where: { id: 'nano' },
        data: { priceARS: 99999999, priceUSD: 2300, originalPriceARS: null, originalPriceUSD: null },
      },
    ]);
    expect(t.cartUpdates[0]).toEqual({
      where: { categoryId: 'lip' },
      data: { priceARS: 600000, priceUSD: 500 },
    });
    expect(t.settings.set).toHaveBeenCalledWith('promo.autoCloseAt', '');
    expect(t.sent).toHaveLength(1);
    expect(t.sent[0].subject).toContain('2 precio(s) restaurado(s)');
    expect(t.sent[0].to).toEqual([{ email: 'charly@example.com' }]);

    // El minuto siguiente ya no hace nada.
    await t.svc.tick(new Date('2026-11-10T00:01:30-03:00'));
    expect(t.prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('si falla 3 veces deja de intentar y avisa para hacerlo a mano', async () => {
    const t = build({ failTx: true });
    for (let i = 0; i < 3; i++) await t.svc.tick(new Date('2026-11-10T00:05:00-03:00'));
    expect(t.prisma.$transaction).toHaveBeenCalledTimes(3);
    expect(t.settings.set).toHaveBeenCalledWith('promo.autoCloseAt', '');
    expect(t.sent).toHaveLength(1);
    expect(t.sent[0].subject).toContain('NO se cerró sola');
  });
});
