import {
  evaluatePromo,
  promoRuleError,
  quoteCart,
  type PricedLine,
  type PromoRule,
} from './shop-pricing';

const rule = (over: Partial<PromoRule>): PromoRule => ({
  id: 'p',
  name: 'Promo',
  kind: 'BUY_X_PAY_Y',
  buyQty: 3,
  payQty: 2,
  percent: null,
  appliesToAll: true,
  productIds: [],
  code: null,
  ...over,
});

const product = (id: string, unitPrice: number, quantity = 1): PricedLine => ({
  kind: 'PRODUCT',
  id,
  name: id,
  quantity,
  unitPrice,
});

describe('shop-pricing', () => {
  it('sin promos: total = subtotal', () => {
    const q = quoteCart(
      [product('a', 100000, 2), product('b', 50000)],
      [],
      'ARS',
    );
    expect(q.subtotal).toBe(250000);
    expect(q.discount).toBe(0);
    expect(q.total).toBe(250000);
    expect(q.promo).toBeNull();
  });

  it('3x2: sale gratis la más barata del grupo', () => {
    const q = quoteCart(
      [product('a', 150000), product('b', 250000), product('c', 100000)],
      [rule({})],
      'ARS',
    );
    expect(q.discount).toBe(100000);
    expect(q.total).toBe(400000);
    expect(q.promo?.label).toBe('3x2');
    expect(q.promo?.freeUnits.map((u) => u.productId)).toEqual(['c']);
  });

  it('3x2 con 5 unidades: un solo grupo completo', () => {
    const q = quoteCart([product('a', 100, 5)], [rule({})], 'USD');
    expect(q.discount).toBe(100);
    expect(q.total).toBe(400);
  });

  it('3x2 con 6 unidades de distinto precio: agrupa de mayor a menor', () => {
    // 600 500 400 | 300 200 100 → gratis 400 y 100
    const lines = [600, 500, 400, 300, 200, 100].map((p, i) =>
      product(`p${i}`, p),
    );
    const q = quoteCart(lines, [rule({})], 'USD');
    expect(q.discount).toBe(500);
  });

  it('3x1: salen gratis las dos más baratas', () => {
    const q = quoteCart(
      [product('a', 300), product('b', 200), product('c', 100)],
      [rule({ buyQty: 3, payQty: 1 })],
      'USD',
    );
    expect(q.discount).toBe(300);
    expect(q.total).toBe(300);
  });

  it('con menos unidades que N no hay descuento', () => {
    const q = quoteCart([product('a', 100, 2)], [rule({})], 'ARS');
    expect(q.discount).toBe(0);
    expect(q.promo).toBeNull();
  });

  it('respeta los productos de la promo', () => {
    const q = quoteCart(
      [product('a', 100), product('b', 100), product('c', 100)],
      [rule({ appliesToAll: false, productIds: ['a', 'b'] })],
      'USD',
    );
    expect(q.discount).toBe(0);
  });

  it('los packs no cuentan para promos', () => {
    const pack: PricedLine = {
      kind: 'PACK',
      id: 'a',
      name: 'pack',
      quantity: 3,
      unitPrice: 100,
    };
    const q = quoteCart(
      [pack],
      [rule({}), rule({ kind: 'PERCENT', percent: 50 })],
      'USD',
    );
    expect(q.discount).toBe(0);
    expect(q.total).toBe(300);
  });

  it('porcentaje: ARS redondea a pesos', () => {
    const q = quoteCart(
      [product('a', 99999)],
      [rule({ kind: 'PERCENT', percent: 15 })],
      'ARS',
    );
    // 15% de 99.999 = 14.999,85 → 15.000
    expect(q.discount).toBe(15000);
    expect(q.total).toBe(84999);
  });

  it('porcentaje: USD redondea a centavos', () => {
    const q = quoteCart(
      [product('a', 33.33)],
      [rule({ kind: 'PERCENT', percent: 10 })],
      'USD',
    );
    expect(q.discount).toBe(3.33);
    expect(q.total).toBe(30);
  });

  it('elige la promo que más ahorra', () => {
    const lines = [product('a', 100), product('b', 100), product('c', 100)];
    const q = quoteCart(
      lines,
      [rule({ id: 'pct', kind: 'PERCENT', percent: 20 }), rule({ id: '3x2' })],
      'USD',
    );
    expect(q.promo?.id).toBe('3x2');
    expect(q.discount).toBe(100);
  });

  it('100% off no deja total negativo', () => {
    const q = quoteCart(
      [product('a', 100)],
      [rule({ kind: 'PERCENT', percent: 100 })],
      'USD',
    );
    expect(q.total).toBe(0);
  });

  it('una promo mal armada no aplica', () => {
    expect(
      promoRuleError({
        kind: 'BUY_X_PAY_Y',
        buyQty: 2,
        payQty: 2,
        percent: null,
      }),
    ).not.toBeNull();
    expect(
      promoRuleError({
        kind: 'PERCENT',
        buyQty: null,
        payQty: null,
        percent: 0,
      }),
    ).not.toBeNull();
    expect(
      evaluatePromo(
        rule({ buyQty: 3, payQty: 3 }),
        [product('a', 100, 3)],
        'USD',
      ).discountCents,
    ).toBe(0);
  });
});
