/**
 * Coupon creator.
 *
 * Mirrors CouponsService.create(): same date normalization (-03:00 boundaries),
 * same duplicate-code guard, same "at least one restriction" rule.
 *
 * Usage:
 *   pnpm exec ts-node scripts/create-coupon.ts \
 *     --code ABHXMERYGARCIA --percent 10 \
 *     --from 2026-12-01 --to 2026-12-01 --all
 *
 * Flags:
 *   --code      coupon code (required)
 *   --percent   discount percent 1-100 (required)
 *   --from      YYYY-MM-DD, starts at 00:00:00 -03:00
 *   --to        YYYY-MM-DD, ends at 23:59:59 -03:00
 *   --max-uses  optional usage cap
 *   --all       appliesToAll = true
 *   --categories  comma-separated VideoCategory ids (when not --all)
 *   --apply     actually write; omit for dry-run
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function main() {
  const code = arg('code')?.trim();
  if (!code) throw new Error('Missing --code');

  const percent = Number(arg('percent'));
  if (!Number.isInteger(percent) || percent < 1 || percent > 100) {
    throw new Error('--percent must be an integer between 1 and 100');
  }

  const from = arg('from');
  const to = arg('to');
  const maxUsesRaw = arg('max-uses');
  const maxUses = maxUsesRaw ? Number(maxUsesRaw) : null;
  const appliesToAll = flag('all');
  const categoryIds =
    arg('categories')?.split(',').map((c) => c.trim()).filter(Boolean) ?? [];

  if (!from && !to && maxUses == null) {
    throw new Error(
      'Se requiere al menos una restricción: fechas de validez o cantidad máxima de usos',
    );
  }
  if (!appliesToAll && categoryIds.length === 0) {
    throw new Error('Debe pasar --categories o --all');
  }

  const existing = await prisma.coupon.findFirst({
    where: { code, deletedAt: null },
  });
  if (existing) {
    throw new Error(`Ya existe un cupón con el código "${code}" (${existing.id})`);
  }

  const validFrom = from ? new Date(`${from}T00:00:00-03:00`) : null;
  const validTo = to ? new Date(`${to}T23:59:59-03:00`) : null;

  const plan = {
    code,
    discountPercent: percent,
    validFrom: validFrom?.toISOString() ?? null,
    validTo: validTo?.toISOString() ?? null,
    maxUses,
    appliesToAll,
    categoryIds,
    isActive: true,
  };

  if (!flag('apply')) {
    console.log('DRY RUN — nada escrito. Se crearía:');
    console.log(JSON.stringify(plan, null, 2));
    console.log('\nCorré de nuevo con --apply para escribir.');
    return;
  }

  const created = await prisma.$transaction(async (tx) => {
    const coupon = await tx.coupon.create({
      data: {
        code,
        discountPercent: percent,
        validFrom,
        validTo,
        maxUses,
        isActive: true,
        appliesToAll,
      },
    });

    if (!appliesToAll && categoryIds.length > 0) {
      await tx.couponCategory.createMany({
        data: categoryIds.map((categoryId) => ({
          couponId: coupon.id,
          categoryId,
        })),
      });
    }

    return coupon;
  });

  console.log('Cupón creado:');
  console.log(JSON.stringify(created, null, 2));
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
