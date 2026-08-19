import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/services';
import {
  CHAT_LIFETIME_DAYS_KEY,
  CHECKOUT_PROMO_ACTIVE_KEY,
  CHECKOUT_PROMO_DISCOUNT_KEY,
  CHECKOUT_PROMO_MAX_INSTALLMENTS_KEY,
  REWARDS_PURCHASE_COUPON_ACTIVE_KEY,
  getSettingDefinition,
  SETTING_DEFINITIONS,
  SettingDefinition,
} from './setting-definitions';

/** TTL del cache en memoria. Las settings cambian poco, se leen mucho. */
const CACHE_TTL_MS = 30_000;

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);
  private cache = new Map<string, { value: string; expiresAt: number }>();

  constructor(private readonly prisma: PrismaService) {}

  private parse(def: SettingDefinition, raw: string): string | number | boolean {
    switch (def.type) {
      case 'int': {
        const n = Number.parseInt(raw, 10);
        return Number.isNaN(n) ? Number.parseInt(def.defaultValue, 10) : n;
      }
      case 'boolean':
        return raw === 'true' || raw === '1';
      default:
        return raw;
    }
  }

  private validate(def: SettingDefinition, raw: string): string {
    if (def.type === 'int') {
      const n = Number.parseInt(raw, 10);
      if (Number.isNaN(n)) {
        throw new BadRequestException(`"${def.label}" debe ser un número entero`);
      }
      if (def.min !== undefined && n < def.min) {
        throw new BadRequestException(`"${def.label}" no puede ser menor a ${def.min}`);
      }
      if (def.max !== undefined && n > def.max) {
        throw new BadRequestException(`"${def.label}" no puede ser mayor a ${def.max}`);
      }
      return String(n);
    }
    if (def.type === 'boolean') {
      if (!['true', 'false', '1', '0'].includes(raw)) {
        throw new BadRequestException(`"${def.label}" debe ser true o false`);
      }
      return raw === 'true' || raw === '1' ? 'true' : 'false';
    }
    return raw;
  }

  /** Valor crudo (string) con fallback al default de la definición. */
  async getRaw(key: string): Promise<string> {
    const def = getSettingDefinition(key);
    if (!def) throw new NotFoundException(`Configuración desconocida: ${key}`);

    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    let value = def.defaultValue;
    try {
      const row = await this.prisma.appSetting.findUnique({ where: { key } });
      if (row) value = row.value;
    } catch (err) {
      // Si la tabla todavía no existe (migración pendiente) no rompemos el chat.
      this.logger.warn(
        `No se pudo leer la setting ${key}, uso default: ${(err as Error).message}`,
      );
    }
    this.cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
    return value;
  }

  async getNumber(key: string): Promise<number> {
    const def = getSettingDefinition(key)!;
    return this.parse(def, await this.getRaw(key)) as number;
  }

  async getChatLifetimeDays(): Promise<number> {
    const days = await this.getNumber(CHAT_LIFETIME_DAYS_KEY);
    return days > 0 ? days : 30;
  }

  async getBoolean(key: string): Promise<boolean> {
    const def = getSettingDefinition(key)!;
    return this.parse(def, await this.getRaw(key)) as boolean;
  }

  /** Promo global fija (descuento sin cupón + tope de cuotas). */
  async getCheckoutPromo(): Promise<{
    active: boolean;
    discountPercent: number;
    maxInstallments: number;
  }> {
    const [active, discountPercent, maxInstallments] = await Promise.all([
      this.getBoolean(CHECKOUT_PROMO_ACTIVE_KEY),
      this.getNumber(CHECKOUT_PROMO_DISCOUNT_KEY),
      this.getNumber(CHECKOUT_PROMO_MAX_INSTALLMENTS_KEY),
    ]);
    return {
      active,
      discountPercent: Math.max(0, Math.min(100, discountPercent)),
      maxInstallments: maxInstallments > 0 ? maxInstallments : 2,
    };
  }

  /** ¿Se emite el cupón-regalo del 20% al confirmar una compra? */
  async isPurchaseRewardActive(): Promise<boolean> {
    return this.getBoolean(REWARDS_PURCHASE_COUPON_ACTIVE_KEY);
  }

  /** Todas las settings conocidas con su valor actual (para el panel admin). */
  async listAll() {
    const rows = await this.prisma.appSetting.findMany();
    const byKey = new Map(rows.map((r) => [r.key, r]));
    return SETTING_DEFINITIONS.map((def) => {
      const row = byKey.get(def.key);
      const raw = row?.value ?? def.defaultValue;
      return {
        key: def.key,
        label: def.label,
        description: def.description,
        type: def.type,
        value: this.parse(def, raw),
        rawValue: raw,
        defaultValue: def.defaultValue,
        min: def.min ?? null,
        max: def.max ?? null,
        updatedAt: row?.updatedAt ?? null,
      };
    });
  }

  async set(key: string, value: string, updatedById?: string) {
    const def = getSettingDefinition(key);
    if (!def) throw new NotFoundException(`Configuración desconocida: ${key}`);
    const clean = this.validate(def, String(value).trim());

    const row = await this.prisma.appSetting.upsert({
      where: { key },
      create: { key, value: clean, description: def.description, updatedById },
      update: { value: clean, updatedById },
    });
    this.cache.set(key, { value: clean, expiresAt: Date.now() + CACHE_TTL_MS });

    return {
      key: row.key,
      value: this.parse(def, row.value),
      rawValue: row.value,
      updatedAt: row.updatedAt,
    };
  }
}
