import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/services';
import { CreateCouponDto, UpdateCouponDto, ValidateCouponDto } from './dto';

@Injectable()
export class CouponsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCouponDto) {
    if (!dto.validFrom && !dto.validTo && dto.maxUses == null) {
      throw new BadRequestException(
        'Se requiere al menos una restricción: fechas de validez o cantidad máxima de usos',
      );
    }

    if (!dto.appliesToAll && (!dto.categoryIds || dto.categoryIds.length === 0)) {
      throw new BadRequestException(
        'Debe seleccionar categorías o marcar "Aplica a todos"',
      );
    }

    const code = dto.code?.trim() || `mery-${dto.discountPercent}`;

    const existing = await this.prisma.coupon.findFirst({
      where: { code, deletedAt: null },
    });
    if (existing) {
      throw new ConflictException(`Ya existe un cupón con el código "${code}"`);
    }

    const validFrom = dto.validFrom ? new Date(`${dto.validFrom}T00:00:00-03:00`) : null;
    const validTo = dto.validTo ? new Date(`${dto.validTo}T23:59:59-03:00`) : null;

    const coupon = await this.prisma.$transaction(async (tx) => {
      const created = await tx.coupon.create({
        data: {
          code,
          discountPercent: dto.discountPercent,
          validFrom,
          validTo,
          maxUses: dto.maxUses ?? null,
          isActive: dto.isActive ?? true,
          appliesToAll: dto.appliesToAll ?? false,
        },
      });

      if (!dto.appliesToAll && dto.categoryIds && dto.categoryIds.length > 0) {
        await tx.couponCategory.createMany({
          data: dto.categoryIds.map((categoryId) => ({
            couponId: created.id,
            categoryId,
          })),
        });
      }

      return tx.coupon.findUnique({
        where: { id: created.id },
        include: {
          categories: { include: { category: { select: { id: true, name: true } } } },
        },
      });
    });

    return this.toResponse(coupon);
  }

  async findAll() {
    const coupons = await this.prisma.coupon.findMany({
      where: { deletedAt: null },
      include: {
        categories: { include: { category: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return coupons.map((c) => this.toResponse(c));
  }

  async findOne(id: string) {
    const coupon = await this.prisma.coupon.findFirst({
      where: { id, deletedAt: null },
      include: {
        categories: { include: { category: { select: { id: true, name: true } } } },
      },
    });

    if (!coupon) throw new NotFoundException('Cupón no encontrado');
    return this.toResponse(coupon);
  }

  async update(id: string, dto: UpdateCouponDto) {
    const existing = await this.prisma.coupon.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Cupón no encontrado');

    if (dto.code && dto.code !== existing.code) {
      const duplicate = await this.prisma.coupon.findFirst({
        where: { code: dto.code, deletedAt: null, id: { not: id } },
      });
      if (duplicate) {
        throw new ConflictException(`Ya existe un cupón con el código "${dto.code}"`);
      }
    }

    const validFrom = dto.validFrom !== undefined
      ? dto.validFrom ? new Date(`${dto.validFrom}T00:00:00-03:00`) : null
      : undefined;
    const validTo = dto.validTo !== undefined
      ? dto.validTo ? new Date(`${dto.validTo}T23:59:59-03:00`) : null
      : undefined;

    const coupon = await this.prisma.$transaction(async (tx) => {
      await tx.coupon.update({
        where: { id },
        data: {
          ...(dto.code && { code: dto.code }),
          ...(dto.discountPercent !== undefined && { discountPercent: dto.discountPercent }),
          ...(validFrom !== undefined && { validFrom }),
          ...(validTo !== undefined && { validTo }),
          ...(dto.maxUses !== undefined && { maxUses: dto.maxUses }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
          ...(dto.appliesToAll !== undefined && { appliesToAll: dto.appliesToAll }),
        },
      });

      if (dto.categoryIds !== undefined) {
        await tx.couponCategory.deleteMany({ where: { couponId: id } });
        if (dto.categoryIds.length > 0) {
          await tx.couponCategory.createMany({
            data: dto.categoryIds.map((categoryId) => ({
              couponId: id,
              categoryId,
            })),
          });
        }
      }

      return tx.coupon.findUnique({
        where: { id },
        include: {
          categories: { include: { category: { select: { id: true, name: true } } } },
        },
      });
    });

    return this.toResponse(coupon);
  }

  async remove(id: string) {
    const existing = await this.prisma.coupon.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Cupón no encontrado');

    if (existing.currentUses > 0) {
      throw new BadRequestException(
        'No se puede eliminar un cupón que ya fue utilizado. Desactivalo en su lugar.',
      );
    }

    await this.prisma.coupon.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async validateCoupon(dto: ValidateCouponDto) {
    const coupon = await this.prisma.coupon.findFirst({
      where: { code: dto.code, deletedAt: null },
      include: { categories: true },
    });

    if (!coupon) {
      return { valid: false, discountPercent: 0, couponCode: dto.code, couponId: null, applicableCategoryIds: [], message: 'Cupón no encontrado' };
    }
    if (!coupon.isActive) {
      return { valid: false, discountPercent: 0, couponCode: dto.code, couponId: null, applicableCategoryIds: [], message: 'Cupón inactivo' };
    }

    const now = new Date();
    if (coupon.validFrom && now < coupon.validFrom) {
      return { valid: false, discountPercent: 0, couponCode: dto.code, couponId: null, applicableCategoryIds: [], message: 'El cupón aún no está vigente' };
    }
    if (coupon.validTo && now > coupon.validTo) {
      return { valid: false, discountPercent: 0, couponCode: dto.code, couponId: null, applicableCategoryIds: [], message: 'El cupón ha expirado' };
    }
    if (coupon.maxUses != null && coupon.currentUses >= coupon.maxUses) {
      return { valid: false, discountPercent: 0, couponCode: dto.code, couponId: null, applicableCategoryIds: [], message: 'El cupón ha alcanzado su límite de usos' };
    }

    // Determine applicable categories
    let applicableCategoryIds: string[];
    if (coupon.appliesToAll) {
      applicableCategoryIds = dto.categoryIds;
    } else {
      const couponCategoryIds = coupon.categories.map((cc) => cc.categoryId);
      applicableCategoryIds = dto.categoryIds.filter((id) => couponCategoryIds.includes(id));
    }

    if (applicableCategoryIds.length === 0) {
      return { valid: false, discountPercent: 0, couponCode: dto.code, couponId: null, applicableCategoryIds: [], message: 'El cupón no aplica para los cursos seleccionados' };
    }

    return {
      valid: true,
      discountPercent: coupon.discountPercent,
      couponCode: coupon.code,
      couponId: coupon.id,
      applicableCategoryIds,
    };
  }

  async consume(id: string, userId: string) {
    const coupon = await this.prisma.coupon.findFirst({
      where: { id, deletedAt: null },
    });
    if (!coupon) throw new NotFoundException('Cupón no encontrado');

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos

    await this.prisma.$transaction(async (tx) => {
      await tx.coupon.update({
        where: { id },
        data: { currentUses: { increment: 1 } },
      });

      await tx.couponConsumption.create({
        data: {
          couponId: id,
          userId,
          status: 'pending',
          expiresAt,
        },
      });
    });

    return { consumptionExpiresAt: expiresAt.toISOString() };
  }

  async release(id: string) {
    const coupon = await this.prisma.coupon.findFirst({
      where: { id, deletedAt: null },
    });
    if (!coupon) throw new NotFoundException('Cupón no encontrado');

    if (coupon.currentUses > 0) {
      await this.prisma.coupon.update({
        where: { id },
        data: { currentUses: { decrement: 1 } },
      });
    }

    // Also expire any pending consumption for this coupon
    await this.prisma.couponConsumption.updateMany({
      where: { couponId: id, status: 'pending' },
      data: { status: 'expired' },
    });
  }

  /**
   * Mark a consumption as confirmed (called by webhook after payment)
   */
  async confirmConsumption(couponId: string, userId: string) {
    await this.prisma.couponConsumption.updateMany({
      where: { couponId, userId, status: 'pending' },
      data: { status: 'confirmed', confirmedAt: new Date() },
    });
  }

  /**
   * Expire pending consumptions that passed their deadline.
   * Called by cron every minute. Releases coupon uses.
   */
  async expirePendingConsumptions(): Promise<number> {
    const now = new Date();

    const toExpire = await this.prisma.couponConsumption.findMany({
      where: { status: 'pending', expiresAt: { lt: now } },
    });

    if (toExpire.length === 0) return 0;

    // Group by couponId to decrement uses correctly
    const couponDecrements = new Map<string, number>();
    for (const c of toExpire) {
      couponDecrements.set(c.couponId, (couponDecrements.get(c.couponId) || 0) + 1);
    }

    await this.prisma.$transaction(async (tx) => {
      // Mark as expired
      await tx.couponConsumption.updateMany({
        where: { id: { in: toExpire.map((c) => c.id) } },
        data: { status: 'expired' },
      });

      // Decrement coupon uses
      for (const [couponId, count] of couponDecrements) {
        const coupon = await tx.coupon.findUnique({ where: { id: couponId } });
        if (coupon && coupon.currentUses > 0) {
          await tx.coupon.update({
            where: { id: couponId },
            data: { currentUses: { decrement: Math.min(count, coupon.currentUses) } },
          });
        }
      }
    });

    return toExpire.length;
  }

  private toResponse(coupon: any) {
    return {
      id: coupon.id,
      code: coupon.code,
      discountPercent: coupon.discountPercent,
      validFrom: coupon.validFrom?.toISOString() || null,
      validTo: coupon.validTo?.toISOString() || null,
      maxUses: coupon.maxUses,
      currentUses: coupon.currentUses,
      isActive: coupon.isActive,
      appliesToAll: coupon.appliesToAll,
      categories: coupon.categories?.map((cc: any) => cc.category) ?? [],
      createdAt: coupon.createdAt.toISOString(),
      updatedAt: coupon.updatedAt.toISOString(),
    };
  }
}
