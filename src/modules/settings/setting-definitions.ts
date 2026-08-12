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
];

export function getSettingDefinition(key: string): SettingDefinition | null {
  return SETTING_DEFINITIONS.find((d) => d.key === key) ?? null;
}
