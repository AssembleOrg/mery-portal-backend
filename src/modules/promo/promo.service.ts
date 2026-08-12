import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../shared/services';
import { CreatePromoCampaignDto, UpdatePromoCampaignDto } from './dto';
import { PromoEmailService } from './promo-email.service';

@Injectable()
export class PromoService {
  private readonly logger = new Logger(PromoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: PromoEmailService,
  ) {}

  private parseDate(value: string, endOfDay = false): Date {
    // Acepta ISO completo o YYYY-MM-DD (interpretado en hora Argentina).
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return new Date(`${value}T${endOfDay ? '23:59:59' : '00:00:00'}-03:00`);
    }
    return new Date(value);
  }

  async create(dto: CreatePromoCampaignDto) {
    const startsAt = this.parseDate(dto.startsAt);
    const endsAt = this.parseDate(dto.endsAt, true);
    if (endsAt <= startsAt) {
      throw new BadRequestException('La fecha de fin debe ser posterior al inicio');
    }
    return this.prisma.promoCampaign.create({
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        startsAt,
        endsAt,
        isActive: dto.isActive ?? true,
        rewardDiscountPercent: dto.rewardDiscountPercent ?? null,
        rewardValidityDays: dto.rewardValidityDays ?? 90,
        rewardExcludeOwned: dto.rewardExcludeOwned ?? true,
      },
    });
  }

  async findAll() {
    const campaigns = await this.prisma.promoCampaign.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { issuedCoupons: true } } },
    });
    return campaigns.map((c) => ({
      ...c,
      issuedCouponsCount: c._count.issuedCoupons,
      _count: undefined,
    }));
  }

  async findOne(id: string) {
    const campaign = await this.prisma.promoCampaign.findUnique({
      where: { id },
      include: { _count: { select: { issuedCoupons: true } } },
    });
    if (!campaign) throw new NotFoundException('Campaña no encontrada');
    return {
      ...campaign,
      issuedCouponsCount: campaign._count.issuedCoupons,
      _count: undefined,
    };
  }

  async update(id: string, dto: UpdatePromoCampaignDto) {
    await this.ensureExists(id);
    return this.prisma.promoCampaign.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description?.trim() || null }
          : {}),
        ...(dto.startsAt !== undefined
          ? { startsAt: this.parseDate(dto.startsAt) }
          : {}),
        ...(dto.endsAt !== undefined
          ? { endsAt: this.parseDate(dto.endsAt, true) }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.rewardDiscountPercent !== undefined
          ? { rewardDiscountPercent: dto.rewardDiscountPercent }
          : {}),
        ...(dto.rewardValidityDays !== undefined
          ? { rewardValidityDays: dto.rewardValidityDays }
          : {}),
        ...(dto.rewardExcludeOwned !== undefined
          ? { rewardExcludeOwned: dto.rewardExcludeOwned }
          : {}),
      },
    });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    await this.prisma.promoCampaign.delete({ where: { id } });
    return { deleted: true };
  }

  private async ensureExists(id: string) {
    const found = await this.prisma.promoCampaign.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!found) throw new NotFoundException('Campaña no encontrada');
  }

  /** IDs de usuarios que compraron (pago completado) dentro de la ventana. */
  private async eligibleUserIds(campaign: {
    startsAt: Date;
    endsAt: Date;
  }): Promise<string[]> {
    const rows = await this.prisma.categoryPurchase.findMany({
      where: {
        paymentStatus: 'completed',
        createdAt: { gte: campaign.startsAt, lte: campaign.endsAt },
      },
      select: { userId: true },
      distinct: ['userId'],
    });
    return rows.map((r) => r.userId);
  }

  /** Vista previa: cuántas alumnas recibirían el cupón-regalo. */
  async previewEligible(id: string) {
    const campaign = await this.prisma.promoCampaign.findUnique({ where: { id } });
    if (!campaign) throw new NotFoundException('Campaña no encontrada');
    const userIds = await this.eligibleUserIds(campaign);
    return {
      eligibleCount: userIds.length,
      alreadyIssued: campaign.rewardsIssuedAt !== null,
      rewardsIssuedAt: campaign.rewardsIssuedAt,
    };
  }

  private async uniqueCode(prefix: string): Promise<string> {
    for (let i = 0; i < 6; i++) {
      const code = `${prefix}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      const exists = await this.prisma.coupon.findUnique({ where: { code } });
      if (!exists) return code;
    }
    // Fallback prácticamente imposible de colisionar.
    return `${prefix}-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
  }

  /**
   * Emite el cupón-regalo por-usuario a quienes compraron en la ventana.
   * Idempotente: no re-emite a quien ya tiene un cupón de esta campaña.
   * @param force si es true, emite aunque la ventana no haya terminado.
   */
  async issueRewards(id: string, force = false) {
    const campaign = await this.prisma.promoCampaign.findUnique({ where: { id } });
    if (!campaign) throw new NotFoundException('Campaña no encontrada');
    if (!campaign.rewardDiscountPercent) {
      throw new BadRequestException('La campaña no tiene recompensa configurada');
    }
    const now = new Date();
    if (!force && now < campaign.endsAt) {
      throw new BadRequestException(
        'La promo todavía no terminó. Usá "forzar" si querés emitir igual.',
      );
    }

    const userIds = await this.eligibleUserIds(campaign);

    // A quiénes ya se les emitió (para no duplicar).
    const already = await this.prisma.coupon.findMany({
      where: { sourceCampaignId: id, userId: { in: userIds } },
      select: { userId: true },
    });
    const alreadySet = new Set(already.map((c) => c.userId));
    const pending = userIds.filter((uid) => !alreadySet.has(uid));

    const validTo = new Date(now);
    validTo.setDate(validTo.getDate() + campaign.rewardValidityDays);
    const validToLabel = validTo.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    let issued = 0;
    let emailed = 0;
    for (const userId of pending) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, firstName: true },
      });
      if (!user) continue;

      const code = await this.uniqueCode('BIEN');
      await this.prisma.coupon.create({
        data: {
          code,
          discountPercent: campaign.rewardDiscountPercent,
          validFrom: now,
          validTo,
          maxUses: 1,
          isActive: true,
          appliesToAll: true,
          userId: user.id,
          excludeOwnedCategories: campaign.rewardExcludeOwned,
          sourceCampaignId: campaign.id,
        },
      });
      issued++;

      const ok = await this.email.sendRewardCoupon({
        to: { email: user.email, name: user.firstName ?? 'Hola' },
        code,
        discountPercent: campaign.rewardDiscountPercent,
        validToLabel,
      });
      if (ok) emailed++;
    }

    await this.prisma.promoCampaign.update({
      where: { id },
      data: { rewardsIssuedAt: campaign.rewardsIssuedAt ?? now },
    });

    this.logger.log(
      `Campaña ${campaign.name}: ${issued} cupón(es) emitido(s), ${emailed} email(s).`,
    );
    return { issued, emailed, skipped: userIds.length - pending.length };
  }

  /**
   * Cron diario: emite recompensas de campañas ya terminadas y pendientes.
   */
  async issueDueRewards(): Promise<{ campaigns: number; issued: number }> {
    const now = new Date();
    const due = await this.prisma.promoCampaign.findMany({
      where: {
        isActive: true,
        rewardsIssuedAt: null,
        rewardDiscountPercent: { not: null },
        endsAt: { lt: now },
      },
      select: { id: true },
    });
    let issued = 0;
    for (const c of due) {
      try {
        const res = await this.issueRewards(c.id);
        issued += res.issued;
      } catch (err) {
        this.logger.error(
          `Error emitiendo recompensas de campaña ${c.id}`,
          err as Error,
        );
      }
    }
    return { campaigns: due.length, issued };
  }
}
