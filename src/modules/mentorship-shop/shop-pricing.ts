/**
 * Cálculo de precios de la tienda de mentorías. Funciones puras (sin Prisma)
 * para poder testear las promos sin base de datos.
 *
 * Reglas:
 * - Todo se calcula en centavos enteros: nada de errores de coma flotante.
 * - En ARS se redondea a pesos enteros; en USD, a centavos.
 * - Se aplica UNA sola promo por compra: la que más ahorra (empate: la primera).
 * - Las promos solo cuentan mentorías sueltas; los packs ya tienen su precio.
 * - NxM (3x2): se ordenan las unidades elegibles de mayor a menor precio, se
 *   agrupan de a N y en cada grupo completo salen gratis las N−M más baratas.
 */

export type ShopCurrency = 'ARS' | 'USD';
export type PromoKind = 'BUY_X_PAY_Y' | 'PERCENT';

export interface PricedLine {
  kind: 'PRODUCT' | 'PACK';
  id: string;
  name: string;
  quantity: number;
  /** Precio unitario en la moneda de la compra. */
  unitPrice: number;
}

export interface PromoRule {
  id: string;
  name: string;
  kind: PromoKind;
  buyQty: number | null;
  payQty: number | null;
  percent: number | null;
  appliesToAll: boolean;
  productIds: string[];
  code: string | null;
}

export interface AppliedPromo {
  id: string;
  name: string;
  kind: PromoKind;
  code: string | null;
  label: string;
  discount: number;
  /** Unidades que salieron gratis (solo NxM), para mostrarlo en el carrito. */
  freeUnits: { productId: string; name: string; unitPrice: number }[];
}

export interface CartQuote {
  currency: ShopCurrency;
  lines: (PricedLine & { lineTotal: number })[];
  subtotal: number;
  discount: number;
  total: number;
  promo: AppliedPromo | null;
}

const toCents = (n: number) => Math.round(n * 100);
const fromCents = (c: number) => c / 100;

/** Redondeo final de un monto en centavos según la moneda. */
function roundCents(cents: number, currency: ShopCurrency): number {
  return currency === 'ARS' ? Math.round(cents / 100) * 100 : Math.round(cents);
}

export function promoLabel(
  p: Pick<PromoRule, 'kind' | 'buyQty' | 'payQty' | 'percent'>,
): string {
  if (p.kind === 'BUY_X_PAY_Y') return `${p.buyQty}x${p.payQty}`;
  return `${p.percent}% off`;
}

/** Valida los parámetros de una promo. Devuelve el error o null. */
export function promoRuleError(
  p: Pick<PromoRule, 'kind' | 'buyQty' | 'payQty' | 'percent'>,
): string | null {
  if (p.kind === 'BUY_X_PAY_Y') {
    const buy = p.buyQty ?? 0;
    const pay = p.payQty ?? -1;
    if (!Number.isInteger(buy) || buy < 2 || buy > 10)
      return 'Llevás: entre 2 y 10';
    if (!Number.isInteger(pay) || pay < 1 || pay >= buy)
      return 'Pagás: al menos 1 y menos que lo que llevás';
    return null;
  }
  const pct = p.percent ?? 0;
  if (!Number.isInteger(pct) || pct < 1 || pct > 100)
    return 'El porcentaje va de 1 a 100';
  return null;
}

/** Descuento (en centavos) que haría una promo sobre las líneas dadas. */
export function evaluatePromo(
  rule: PromoRule,
  lines: PricedLine[],
  currency: ShopCurrency,
): { discountCents: number; freeUnits: AppliedPromo['freeUnits'] } {
  if (promoRuleError(rule)) return { discountCents: 0, freeUnits: [] };
  const eligible = new Set(rule.productIds);
  const units: { productId: string; name: string; cents: number }[] = [];
  for (const l of lines) {
    if (l.kind !== 'PRODUCT') continue;
    if (!rule.appliesToAll && !eligible.has(l.id)) continue;
    for (let i = 0; i < l.quantity; i++) {
      units.push({
        productId: l.id,
        name: l.name,
        cents: toCents(l.unitPrice),
      });
    }
  }
  if (units.length === 0) return { discountCents: 0, freeUnits: [] };

  if (rule.kind === 'PERCENT') {
    const base = units.reduce((s, u) => s + u.cents, 0);
    return {
      discountCents: roundCents(
        (base * (rule.percent as number)) / 100,
        currency,
      ),
      freeUnits: [],
    };
  }

  const buy = rule.buyQty as number;
  const free = buy - (rule.payQty as number);
  // Orden estable: mayor precio primero; a igual precio, el orden del carrito.
  const sorted = units
    .map((u, i) => ({ ...u, i }))
    .sort((a, b) => b.cents - a.cents || a.i - b.i);
  const groups = Math.floor(sorted.length / buy);
  const freeUnits: AppliedPromo['freeUnits'] = [];
  let discountCents = 0;
  for (let g = 0; g < groups; g++) {
    const group = sorted.slice(g * buy, (g + 1) * buy);
    for (const u of group.slice(buy - free)) {
      discountCents += u.cents;
      freeUnits.push({
        productId: u.productId,
        name: u.name,
        unitPrice: fromCents(u.cents),
      });
    }
  }
  return { discountCents, freeUnits };
}

/**
 * Cotiza el carrito. `promos` ya viene filtrado a las vigentes (fechas, cupo,
 * activas) y a las que corresponden: las automáticas + la del código ingresado.
 */
export function quoteCart(
  lines: PricedLine[],
  promos: PromoRule[],
  currency: ShopCurrency,
): CartQuote {
  const priced = lines.map((l) => {
    const lineCents = toCents(l.unitPrice) * l.quantity;
    return { ...l, lineTotal: fromCents(lineCents) };
  });
  const subtotalCents = priced.reduce((s, l) => s + toCents(l.lineTotal), 0);

  let best: (AppliedPromo & { cents: number }) | null = null;
  for (const rule of promos) {
    const { discountCents, freeUnits } = evaluatePromo(rule, lines, currency);
    if (discountCents <= 0) continue;
    if (!best || discountCents > best.cents) {
      best = {
        id: rule.id,
        name: rule.name,
        kind: rule.kind,
        code: rule.code,
        label: promoLabel(rule),
        discount: fromCents(discountCents),
        freeUnits,
        cents: discountCents,
      };
    }
  }

  const discountCents = Math.min(best?.cents ?? 0, subtotalCents);
  let promo: AppliedPromo | null = null;
  if (best) {
    const { cents, ...rest } = best;
    promo = { ...rest, discount: fromCents(Math.min(cents, discountCents)) };
  }
  return {
    currency,
    lines: priced,
    subtotal: fromCents(subtotalCents),
    discount: fromCents(discountCents),
    total: fromCents(subtotalCents - discountCents),
    promo,
  };
}
