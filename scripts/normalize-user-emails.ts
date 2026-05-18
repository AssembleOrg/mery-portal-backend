/**
 * Email normalization + dedup script.
 *
 * Detects users whose email differs only by case/whitespace ("Dolores@x" vs
 * "dolores@x") and reports them. Optionally (with --apply) soft-deletes the
 * duplicates and lowercases every remaining email so future lookups are
 * consistent.
 *
 * Usage:
 *   pnpm exec ts-node scripts/normalize-user-emails.ts             # dry-run (default)
 *   pnpm exec ts-node scripts/normalize-user-emails.ts --apply     # actually modify the DB
 *
 * Dedup policy when --apply is used:
 *   - Within each collision group, keep the user with the most
 *     CategoryPurchase records (i.e. the one that actually bought something).
 *     Ties broken by oldest createdAt (the original account wins).
 *   - The other members of the group are soft-deleted (deletedAt = NOW()) and
 *     their email is suffixed with `+dup-<id>@<domain>` to free up the
 *     normalized email for the survivor.
 *   - Run inside a single transaction; any error rolls everything back.
 *
 * IMPORTANT: this script does not move carts/purchases/etc. between accounts.
 * It assumes the duplicates are unused shells. If a duplicate actually has
 * purchases the script will refuse to delete and ask you to resolve manually.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function normalize(email: string): string {
  return email.trim().toLowerCase();
}

type UserRow = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  createdAt: Date;
  deletedAt: Date | null;
  _count: { categoryPurchases: number };
};

async function findCollisionGroups(): Promise<Map<string, UserRow[]>> {
  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      createdAt: true,
      deletedAt: true,
      _count: { select: { categoryPurchases: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  const groups = new Map<string, UserRow[]>();
  for (const u of users) {
    const key = normalize(u.email);
    const bucket = groups.get(key) ?? [];
    bucket.push(u);
    groups.set(key, bucket);
  }
  // Keep only groups with collisions (>1 row OR a row whose stored email
  // already differs from its normalized form).
  for (const [key, bucket] of groups) {
    const needsAction =
      bucket.length > 1 || bucket.some((u) => u.email !== key);
    if (!needsAction) groups.delete(key);
  }
  return groups;
}

function pickSurvivor(group: UserRow[]): UserRow {
  // Highest purchase count wins; tiebreak by oldest createdAt.
  return [...group].sort((a, b) => {
    if (b._count.categoryPurchases !== a._count.categoryPurchases) {
      return b._count.categoryPurchases - a._count.categoryPurchases;
    }
    return a.createdAt.getTime() - b.createdAt.getTime();
  })[0];
}

function formatRow(u: UserRow): string {
  const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || '(sin nombre)';
  return `    [${u.id}] ${u.email}  ·  ${name}  ·  purchases=${u._count.categoryPurchases}  ·  created=${u.createdAt.toISOString().slice(0, 10)}`;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const mode = apply ? 'APPLY (escribe en la DB)' : 'DRY-RUN (solo lectura)';
  console.log(`\n=== normalize-user-emails — modo: ${mode} ===\n`);

  const groups = await findCollisionGroups();
  if (groups.size === 0) {
    console.log('No hay duplicados case-insensitive ni emails con mayúsculas/espacios. ✅');
    await prisma.$disconnect();
    return;
  }

  console.log(`Encontrados ${groups.size} grupo(s) que requieren acción:\n`);
  const conflictsWithPurchases: { group: UserRow[]; survivor: UserRow }[] = [];
  for (const [key, bucket] of groups) {
    const survivor = pickSurvivor(bucket);
    console.log(`  → normalized: "${key}"`);
    for (const u of bucket) {
      const tag = u.id === survivor.id ? '✓ SURVIVOR' : '✗ to delete';
      console.log(`    ${tag}`);
      console.log(formatRow(u));
    }
    const losers = bucket.filter((u) => u.id !== survivor.id);
    const losersWithPurchases = losers.filter((u) => u._count.categoryPurchases > 0);
    if (losersWithPurchases.length > 0) {
      conflictsWithPurchases.push({ group: bucket, survivor });
    }
    console.log('');
  }

  if (conflictsWithPurchases.length > 0) {
    console.log('⚠️  ATENCIÓN: hay duplicados a eliminar que tienen CategoryPurchases asociadas.');
    console.log('   Resolvelos manualmente antes de correr --apply (reasignando los purchases');
    console.log('   al survivor con prisma studio, o ajustando este script).');
    for (const c of conflictsWithPurchases) {
      const loserIds = c.group.filter((u) => u.id !== c.survivor.id && u._count.categoryPurchases > 0).map((u) => u.id);
      console.log(`   - grupo "${normalize(c.survivor.email)}" → ids con compras: ${loserIds.join(', ')}`);
    }
    console.log('');
    if (apply) {
      console.log('Abortando --apply por seguridad.\n');
      await prisma.$disconnect();
      process.exit(1);
    }
  }

  if (!apply) {
    console.log('Esto fue un dry-run. Para aplicar los cambios, corré:');
    console.log('  pnpm exec ts-node scripts/normalize-user-emails.ts --apply\n');
    await prisma.$disconnect();
    return;
  }

  // APPLY MODE
  console.log('Aplicando cambios dentro de una transacción...\n');
  await prisma.$transaction(async (tx) => {
    for (const [key, bucket] of groups) {
      const survivor = pickSurvivor(bucket);
      const losers = bucket.filter((u) => u.id !== survivor.id);

      // Soft-delete losers and mutate their email so it no longer collides
      // with the survivor's normalized email (Prisma enforces unique on email).
      for (const loser of losers) {
        const [localPart, domain] = loser.email.split('@');
        const stamped = `${localPart}+dup-${loser.id}@${domain ?? 'unknown'}`;
        await tx.user.update({
          where: { id: loser.id },
          data: {
            email: stamped,
            deletedAt: new Date(),
            isActive: false,
          },
        });
        console.log(`  ✗ soft-deleted ${loser.id} (email → ${stamped})`);
      }

      // Normalize survivor email.
      if (survivor.email !== key) {
        await tx.user.update({
          where: { id: survivor.id },
          data: { email: key },
        });
        console.log(`  ✓ survivor ${survivor.id} email "${survivor.email}" → "${key}"`);
      }
    }

    // Final pass: normalize every remaining email that isn't already lowercase.
    const remaining = await tx.user.findMany({
      where: { deletedAt: null },
      select: { id: true, email: true },
    });
    let normalized = 0;
    for (const u of remaining) {
      const n = normalize(u.email);
      if (n !== u.email) {
        await tx.user.update({ where: { id: u.id }, data: { email: n } });
        normalized++;
      }
    }
    console.log(`\n  Normalizados ${normalized} email(s) restantes a lowercase.`);
  });

  console.log('\nListo. ✅\n');
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('Error:', err);
  await prisma.$disconnect();
  process.exit(1);
});
