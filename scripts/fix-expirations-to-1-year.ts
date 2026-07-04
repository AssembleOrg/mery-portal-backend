/**
 * Corrige compras que quedaron con acceso de ~6 meses (175-190 días) cuando
 * en realidad se vendieron con acceso de 1 año.
 *
 * Nuevo vencimiento: createdAt + 1 año.
 *
 * Uso:
 *   npx ts-node scripts/fix-expirations-to-1-year.ts          # dry-run (no escribe)
 *   APPLY=1 npx ts-node scripts/fix-expirations-to-1-year.ts  # aplica los cambios
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APPLY = process.env.APPLY === '1';

function addOneYear(date: Date): Date {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + 1);
  return d;
}

async function main() {
  const purchases = await prisma.categoryPurchase.findMany({
    where: { expiresAt: { not: null } },
    include: {
      user: { select: { email: true } },
      category: { select: { slug: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  const targets = purchases.filter((p) => {
    const days = Math.round(
      (p.expiresAt!.getTime() - p.createdAt.getTime()) / 86400000,
    );
    return days >= 175 && days <= 190;
  });

  console.log(
    `${APPLY ? 'APLICANDO' : 'DRY-RUN'} — compras ~6 meses a corregir: ${targets.length}\n`,
  );
  console.log('email | curso | compra | vence_actual | vence_nuevo');

  for (const p of targets) {
    const newExpiry = addOneYear(p.createdAt);
    console.log(
      [
        p.user.email,
        p.category.slug,
        p.createdAt.toISOString().slice(0, 10),
        p.expiresAt!.toISOString().slice(0, 10),
        '→ ' + newExpiry.toISOString().slice(0, 10),
      ].join(' | '),
    );
  }

  if (!APPLY) {
    console.log('\nDry-run: no se modificó nada. Ejecutar con APPLY=1 para aplicar.');
    return;
  }

  // Un solo UPDATE atómico (el loop con transacción interactiva se pasa del
  // timeout contra la BD remota). Mismo filtro que el dry-run.
  const updated = await prisma.$executeRaw`
    UPDATE category_purchases
    SET "expiresAt" = "createdAt" + interval '1 year',
        "isActive"  = true,
        "updatedAt" = now()
    WHERE "expiresAt" IS NOT NULL
      AND ("expiresAt" - "createdAt") BETWEEN interval '175 days' AND interval '190 days'
  `;

  console.log(`\n✅ Actualizadas ${updated} compras a vencimiento de 1 año.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
