/**
 * Actualiza el successMessage del formulario de la Master Class:
 * el mensaje anterior confirmaba el lugar ("Tu lugar quedó reservado"),
 * pero la confirmación se envía después por email.
 *
 * Uso:
 *   npx ts-node scripts/update-masterclass-success-message.ts          # dry-run
 *   APPLY=1 npx ts-node scripts/update-masterclass-success-message.ts  # aplica
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APPLY = process.env.APPLY === '1';

const SLUG = 'masterclass-autostyling';

const NEW_MESSAGE =
  '¡Gracias por registrarte! Recibimos tu inscripción correctamente. En breve te enviaremos por email la confirmación de tu lugar para el viernes 24/7 en Juleriaque (Cabildo 1985, CABA). 💕';

async function main() {
  const form = await prisma.form.findUnique({ where: { slug: SLUG } });
  if (!form) {
    console.log(`No existe formulario con slug "${SLUG}".`);
    return;
  }

  console.log(`Formulario: ${form.id} (${form.title})`);
  console.log(`successMessage actual:\n  ${form.successMessage}`);
  console.log(`successMessage nuevo:\n  ${NEW_MESSAGE}`);

  if (!APPLY) {
    console.log('\n[dry-run] Ejecutá con APPLY=1 para aplicar.');
    return;
  }

  await prisma.form.update({
    where: { id: form.id },
    data: { successMessage: NEW_MESSAGE },
  });
  console.log('\nActualizado.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
