import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../shared/services';
import { RewardEmailService } from './reward-email.service';
import { SettingsService } from '../settings/settings.service';

/** % del cupón-regalo que se emite en cada compra. */
const REWARD_DISCOUNT_PERCENT = 20;
/** Duración del cupón-regalo (6 meses). */
const REWARD_VALIDITY_MONTHS = 6;

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
}
