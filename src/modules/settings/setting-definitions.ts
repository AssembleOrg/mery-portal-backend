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
  /** Solo para type 'string': valores admitidos (se renderiza como select). */
  allowedValues?: string[];
}

export const CHAT_LIFETIME_DAYS_KEY = 'chat.lifetimeDays';
export const CHAT_CLOSING_MESSAGE_KEY = 'chat.closingMessage';

// Señas de clases presenciales: cotización del dólar y disclaimer previo al pago.
export const PRESENCIAL_DOLLAR_MODE_KEY = 'presencial.dollarMode';
export const PRESENCIAL_DOLLAR_RATE_FIXED_KEY = 'presencial.dollarRateFixed';
export const PRESENCIAL_DOLLAR_RATE_CACHED_KEY = 'presencial.dollarRateCached';
export const PRESENCIAL_DEPOSIT_DISCLAIMER_KEY = 'presencial.depositDisclaimer';

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
    key: CHAT_CLOSING_MESSAGE_KEY,
    label: 'Mensaje de despedida del chat',
    description:
      'Se envía como último mensaje en el chat cuando la sala se cierra (por vencimiento o porque un admin la bloqueó). Se manda una sola vez por cierre. Dejalo vacío para no enviar nada.',
    type: 'string',
    defaultValue:
      '¡Gracias por haber sido parte de esta formación! Este chat se cierra acá, pero seguimos en contacto por redes y por mail para lo que necesites. Te deseamos muchos éxitos. 💕',
    max: 1000,
  },
  {
    key: PRESENCIAL_DOLLAR_MODE_KEY,
    label: 'Cotización del dólar (presenciales)',
    description:
      'De dónde sale el dólar para convertir las señas en USD. "fijo" usa el valor que cargues acá abajo; "api" lo trae de mery-garcia-backend una vez por día (si falla, cae al valor fijo).',
    type: 'string',
    defaultValue: 'fixed',
    allowedValues: ['fixed', 'api'],
  },
  {
    key: PRESENCIAL_DOLLAR_RATE_FIXED_KEY,
    label: 'Dólar fijo (pesos por USD)',
    description:
      'Valor usado cuando la cotización está en modo "fijo", y también como respaldo si la API no responde.',
    type: 'int',
    defaultValue: '1200',
    min: 1,
    max: 1000000,
  },
  {
    key: PRESENCIAL_DOLLAR_RATE_CACHED_KEY,
    label: 'Última cotización traída de la API',
    description:
      'Se actualiza sola una vez por día cuando el modo es "api". 0 = todavía no se pudo traer ninguna. Podés editarla, pero la próxima actualización la pisa.',
    type: 'int',
    defaultValue: '0',
    min: 0,
    max: 1000000,
  },
  {
    key: PRESENCIAL_DEPOSIT_DISCLAIMER_KEY,
    label: 'Disclaimer de la seña (presenciales)',
    description:
      'Texto que la alumna tiene que aceptar ANTES de ir a pagar la seña. Se muestra en el popup de reserva. Dejá una línea en blanco entre párrafos.',
    type: 'string',
    defaultValue:
      'Al pagar la seña reservás tu lugar en una clase presencial. La fecha y el horario que ves ahora son tentativos: te confirmamos hasta 15 días antes si la clase se dicta en ese turno.\n\nSi esa fecha se reprograma, tu lugar y tu seña se trasladan a la nueva fecha, sin costo extra y sin que tengas que volver a reservar. Te avisamos por email y en la app para que puedas acomodarte.',
    max: 1500,
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
