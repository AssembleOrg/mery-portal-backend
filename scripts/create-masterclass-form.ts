/**
 * Crea el formulario público de la Master Class de Autostyling
 * (Mery García x Anastasia Beverly Hills & Juleriaque).
 *
 * Idempotente: si ya existe un form con el slug, no crea otro.
 *
 * Uso:
 *   npx ts-node scripts/create-masterclass-form.ts            # dry-run (muestra qué crearía)
 *   APPLY=1 npx ts-node scripts/create-masterclass-form.ts    # crea el formulario (draft)
 *   APPLY=1 PUBLISH=1 npx ts-node scripts/create-masterclass-form.ts  # crea y publica
 */
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();
const APPLY = process.env.APPLY === '1';
const PUBLISH = process.env.PUBLISH === '1';

const SLUG = 'masterclass-autostyling';

const uid = () => randomUUID();

const fields = [
  {
    id: uid(),
    type: 'text',
    label: 'Nombre/s y Apellido/s',
    placeholder: 'Tu nombre completo',
    required: true,
  },
  {
    id: uid(),
    type: 'email',
    label: 'Mail',
    placeholder: 'tu@email.com',
    required: true,
  },
  {
    id: uid(),
    type: 'phone',
    label: 'Teléfono',
    description: 'Seleccioná tu país e ingresá tu número completo',
    required: true,
  },
  {
    id: uid(),
    type: 'text',
    label: 'Profesión u Ocupación',
    placeholder: 'Ej: Maquilladora, Estudiante, Abogada…',
    required: true,
  },
  {
    id: uid(),
    type: 'checkbox',
    label: '¿Sos clienta nuestra?',
    description: 'Podés marcar más de una opción',
    required: false,
    options: [
      { id: uid(), label: 'Estilismo' },
      { id: uid(), label: 'Cosmetic Tattoo' },
      { id: uid(), label: 'Formaciones' },
      { id: uid(), label: 'Todavía no soy clienta' },
    ],
  },
  {
    id: uid(),
    type: 'yesno',
    label: '¿Conociste algún producto de Anastasia a través de nosotras?',
    required: true,
    allowContext: true,
    contextLabel: '¿Querés contarnos cuál o cómo? (opcional)',
  },
  {
    id: uid(),
    type: 'textarea',
    label: '¿Tenés alguna duda puntual que quieras hacernos?',
    placeholder: 'Contanos tu duda…',
    required: false,
  },
  {
    id: uid(),
    type: 'textarea',
    label: '¿Hay algo puntual que te gustaría aprender?',
    placeholder: 'Contanos qué te gustaría aprender…',
    required: false,
  },
  {
    id: uid(),
    type: 'info',
    label: 'Fecha de la Masterclass',
    description:
      '📅 Viernes 24/7\n📍 Cabildo 1985, CABA',
  },
  {
    id: uid(),
    type: 'radio',
    label: '¿En qué horario querés participar?',
    description: 'Solo podés seleccionar uno',
    required: true,
    options: [
      { id: uid(), label: '16:30 a 18:00 hs' },
      { id: uid(), label: '18:30 a 20:00 hs' },
    ],
  },
];

async function main() {
  const existing = await prisma.form.findUnique({ where: { slug: SLUG } });
  if (existing) {
    console.log(`Ya existe un formulario con slug "${SLUG}" (id ${existing.id}). No se crea otro.`);
    return;
  }

  const data = {
    title:
      'Mery García te invita a su primer Master Class de Autostyling junto a Anastasia Beverly Hills & Juleriaque',
    slug: SLUG,
    description:
      'Completá tus datos para reservar tu lugar. ¡Te esperamos!',
    status: (PUBLISH ? 'published' : 'draft') as 'published' | 'draft',
    fields,
    successMessage:
      '¡Gracias por registrarte! Tu lugar quedó reservado. Nos vemos el viernes 24/7 en Cabildo 1985, CABA. 💕',
    closedMessage:
      'Las inscripciones a la Master Class ya están cerradas. ¡Gracias por tu interés!',
    submitLabel: 'Reservar mi lugar',
  };

  if (!APPLY) {
    console.log('[dry-run] Se crearía el formulario:');
    console.log(JSON.stringify(data, null, 2));
    console.log('\nEjecutá con APPLY=1 para crearlo.');
    return;
  }

  const form = await prisma.form.create({ data: data as any });
  console.log(`Formulario creado: ${form.id} (status: ${form.status})`);
  console.log(`URL pública: /f/${form.slug}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
