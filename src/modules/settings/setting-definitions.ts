/**
 * Registro de settings editables desde el panel admin.
 *
 * Cada entrada define su key, su valor por defecto (usado si la fila no existe
 * en la DB) y cómo validar lo que manda el admin. Agregar una config nueva es
 * sumar una entrada acá; no hace falta migración.
 */

export type SettingType = 'int' | 'boolean' | 'string';

export interface SettingDefinition {
  key: string;
  label: string;
  description: string;
  type: SettingType;
  defaultValue: string;
  min?: number;
  max?: number;
}

export const CHAT_LIFETIME_DAYS_KEY = 'chat.lifetimeDays';

// Promo global fija (sin cupón): descuento automático + tope de cuotas para
// cualquier compra en pesos mientras esté activa.
export const CHECKOUT_PROMO_ACTIVE_KEY = 'checkout.promoActive';
export const CHECKOUT_PROMO_DISCOUNT_KEY = 'checkout.promoDiscountPercent';
export const CHECKOUT_PROMO_MAX_INSTALLMENTS_KEY = 'checkout.promoMaxInstallments';

// Cupón-regalo del 20% que se emite al confirmar una compra.
export const REWARDS_PURCHASE_COUPON_ACTIVE_KEY = 'rewards.purchaseCouponActive';

export const SETTING_DEFINITIONS: SettingDefinition[] = [
  {
    key: CHAT_LIFETIME_DAYS_KEY,
    label: 'Días de vida del chat',
    description:
      'Días que un chat permanece abierto desde que se desbloquea. Al vencer queda solo lectura. El admin puede extenderlo, y comprar otra formación lo reabre.',
    type: 'int',
    defaultValue: '30',
    min: 1,
    max: 3650,
  },
  {
    key: CHECKOUT_PROMO_ACTIVE_KEY,
    label: 'Promo activa (descuento global)',
    description:
      'Si está activa, se aplica un descuento fijo a TODA compra en pesos (sin cupón) y se limita el pago a un máximo de cuotas.',
    type: 'boolean',
    defaultValue: 'false',
  },
  {
    key: CHECKOUT_PROMO_DISCOUNT_KEY,
    label: 'Descuento de la promo (%)',
    description:
      'Porcentaje de descuento que aplica la promo global a cualquier compra en pesos (solo si la promo está activa).',
    type: 'int',
    defaultValue: '40',
    min: 0,
    max: 100,
  },
  {
    key: CHECKOUT_PROMO_MAX_INSTALLMENTS_KEY,
    label: 'Máximo de cuotas en promo',
    description:
      'Cantidad máxima de cuotas permitida mientras la promo está activa (ej. 2).',
    type: 'int',
    defaultValue: '2',
    min: 1,
    max: 12,
  },
  {
    key: REWARDS_PURCHASE_COUPON_ACTIVE_KEY,
    label: 'Cupón-regalo 20% por compra',
    description:
      'Si está activo, cada compra confirmada emite un cupón personal del 20% (6 meses) y manda un email de agradecimiento.',
    type: 'boolean',
    defaultValue: 'false',
  },
];

export function getSettingDefinition(key: string): SettingDefinition | null {
  return SETTING_DEFINITIONS.find((d) => d.key === key) ?? null;
}
