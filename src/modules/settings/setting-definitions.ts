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

export const CHAT_TOKEN_LIMIT_KEY = 'chat.tokenLimit';

export const SETTING_DEFINITIONS: SettingDefinition[] = [
  {
    key: CHAT_TOKEN_LIMIT_KEY,
    label: 'Tokens para bloquear el chat',
    description:
      'Cantidad de tokens que el admin debe marcar en una conversación para que el alumno deje de poder escribir en ella.',
    type: 'int',
    defaultValue: '3',
    min: 1,
    max: 50,
  },
];

export function getSettingDefinition(key: string): SettingDefinition | null {
  return SETTING_DEFINITIONS.find((d) => d.key === key) ?? null;
}
