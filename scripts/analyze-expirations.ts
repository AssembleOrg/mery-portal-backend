/**
 * READ-ONLY: analiza duración de accesos (expiresAt - createdAt) en category_purchases.
 * No modifica nada.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const purchases = await prisma.categoryPurchase.findMany({
    include: {
      user: { select: { email: true } },
      category: { select: { name: true, slug: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  const now = new Date();
  const buckets = new Map<string, number>();
  const rows: string[] = [];

  for (const p of purchases) {
    let bucket: string;
    let days: number | null = null;
    if (!p.expiresAt) {
      bucket = 'permanente (null)';
    } else {
      days = Math.round(
        (p.expiresAt.getTime() - p.createdAt.getTime()) / 86400000,
      );
      if (days >= 350 && days <= 380) bucket = '~1 año (350-380d)';
      else if (days >= 175 && days <= 190) bucket = '~6 meses (175-190d)';
      else if (days >= 85 && days <= 100) bucket = '~3 meses (85-100d)';
      else bucket = `otro (${days}d)`;
    }
    buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);

    if (days !== null && days >= 350 && days <= 380) {
      const newExpiry = new Date(p.createdAt);
      newExpiry.setDate(newExpiry.getDate() + 183);
      const wouldBeExpired = newExpiry < now;
      rows.push(
        [
          p.id,
          p.user.email,
          p.category.slug,
          p.paymentMethod ?? '-',
          p.createdAt.toISOString().slice(0, 10),
          p.expiresAt!.toISOString().slice(0, 10),
          '→ ' + newExpiry.toISOString().slice(0, 10),
          wouldBeExpired ? '⚠️ QUEDARÍA VENCIDO' : 'ok',
        ].join(' | '),
      );
    }
  }

  console.log('=== Distribución de duraciones ===');
  for (const [k, v] of [...buckets.entries()].sort()) {
    console.log(`${k}: ${v}`);
  }

  console.log(`\n=== Compras ~1 año (candidatas a corregir): ${rows.length} ===`);
  console.log(
    'id | email | curso | metodo | compra | vence_hoy | vence_corregido | estado',
  );
  for (const r of rows) console.log(r);

  console.log('\n=== Categorías (para identificar cursos de cejas) ===');
  const cats = await prisma.videoCategory.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, slug: true },
  });
  for (const c of cats) console.log(`${c.id} | ${c.slug} | ${c.name}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
