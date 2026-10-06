import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../shared/services';
import { RewardEmailService } from './reward-email.service';
import { SettingsService } from '../settings/settings.service';

/** % del cupón-regalo que se emite en cada compra. */
const REWARD_DISCOUNT_PERCENT = 20;
/** Duración del cupón-regalo (6 meses). */
const REWARD_VALIDITY_MONTHS = 6;

/**
 * Cupón "nueva formación" que se reclama al completar el formulario de la
 * mentoría. El prefijo identifica el cupón: una cuenta reclama uno solo.
 */
const NEW_COURSE_COUPON_PREFIX = 'NUEVA20';
const NEW_COURSE_DISCOUNT_PERCENT = 20;
const NEW_COURSE_VALIDITY_MONTHS = 3;

@Injectable()
export class RewardsService {
  private readonly logger = new Logger(RewardsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: RewardEmailService,
    private readonly settings: SettingsService,
  ) {}

  private async uniqueCode(prefix: string): Promise<string> {
    for (let i = 0; i < 6; i++) {
      const code = `${prefix}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      const exists = await this.prisma.coupon.findUnique({ where: { code } });
      if (!exists) return code;
    }
    return `${prefix}-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
  }

  /**
   * Emite el cupón-regalo personal del 20% por una compra confirmada y manda el
   * email de agradecimiento. Se llama una vez por pago aprobado (no por item).
   * El cupón:
   *  - es personal (userId): solo lo usa esa cuenta,
   *  - excluye las formaciones ya compradas ("otra formación"),
   *  - un solo uso, válido 6 meses,
   *  - no acumulable con otro cupón (el checkout aplica un solo cupón por orden).
   */
  async issuePurchaseReward(
    userId: string,
    courseNames: string[] = [],
  ): Promise<{ code: string } | null> {
    // Toggle: por ahora el cupón-regalo por compra está apagado.
    if (!(await this.settings.isPurchaseRewardActive())) {
      return null;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, firstName: true },
    });
    if (!user) return null;

    const now = new Date();
    const validTo = new Date(now);
    validTo.setMonth(validTo.getMonth() + REWARD_VALIDITY_MONTHS);

    const code = await this.uniqueCode('GRACIAS');
    await this.prisma.coupon.create({
      data: {
        code,
        discountPercent: REWARD_DISCOUNT_PERCENT,
        validFrom: now,
        validTo,
        maxUses: 1,
        isActive: true,
        appliesToAll: true,
        userId: user.id,
        excludeOwnedCategories: true,
      },
    });

    const validToLabel = validTo.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const emailed = await this.email.sendThankYou({
      to: { email: user.email, name: user.firstName ?? 'Hola' },
      courseNames,
      code,
      discountPercent: REWARD_DISCOUNT_PERCENT,
      validToLabel,
    });

    this.logger.log(
      `Cupón-regalo ${code} emitido a ${user.email}${emailed ? '' : ' (email falló)'}`,
    );
    return { code };
  }

  /**
   * Emite (una sola vez por cuenta) el cupón 20% OFF para una nueva formación,
   * válido 3 meses, que se reclama desde el formulario de la mentoría.
   * Personal, un uso, no aplica a lo ya comprado. No es acumulable: el checkout
   * acepta un solo cupón y no lo combina con la promo global.
   * Si ya lo había reclamado, devuelve el mismo en vez de crear otro.
   */
  async claimNewCourseCoupon(
    userId: string,
  ): Promise<{ code: string; validTo: string; alreadyClaimed: boolean }> {
    const existing = await this.prisma.coupon.findFirst({
      where: {
        userId,
        code: { startsWith: `${NEW_COURSE_COUPON_PREFIX}-` },
        deletedAt: null,
      },
      select: { code: true, validTo: true },
    });
    if (existing) {
      return {
        code: existing.code,
        validTo: (existing.validTo ?? new Date()).toISOString(),
        alreadyClaimed: true,
      };
    }

    const now = new Date();
    const validTo = new Date(now);
    validTo.setMonth(validTo.getMonth() + NEW_COURSE_VALIDITY_MONTHS);

    const code = await this.uniqueCode(NEW_COURSE_COUPON_PREFIX);
    await this.prisma.coupon.create({
      data: {
        code,
        discountPercent: NEW_COURSE_DISCOUNT_PERCENT,
        validFrom: now,
        validTo,
        maxUses: 1,
        isActive: true,
        appliesToAll: true,
        userId,
        excludeOwnedCategories: true,
      },
    });
    this.logger.log(`Cupón nueva formación ${code} emitido a ${userId}`);
    return { code, validTo: validTo.toISOString(), alreadyClaimed: false };
  }
}
