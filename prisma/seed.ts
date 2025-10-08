import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed de datos...');

  // Crear usuario admin
  const adminPassword = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@mery.com' },
    update: {},
    create: {
      email: 'admin@mery.com',
      password: adminPassword,
      role: UserRole.ADMIN,
      firstName: 'Admin',
      lastName: 'Mery',
      isActive: true,
      isEmailVerified: true, // Pre-verified for testing
    },
  });

  // Crear usuario subadmin
  const subadminPassword = await bcrypt.hash('subadmin123', 12);
  const subadmin = await prisma.user.upsert({
    where: { email: 'subadmin@mery.com' },
    update: {},
    create: {
      email: 'subadmin@mery.com',
      password: subadminPassword,
      role: UserRole.SUBADMIN,
      firstName: 'Subadmin',
      lastName: 'Mery',
      isActive: true,
      isEmailVerified: true, // Pre-verified for testing
    },
  });

  // Crear usuario de prueba
  const userPassword = await bcrypt.hash('user123', 12);
  const user = await prisma.user.upsert({
    where: { email: 'user@mery.com' },
    update: {},
    create: {
      email: 'user@mery.com',
      password: userPassword,
      role: UserRole.USER,
      firstName: 'Usuario',
      lastName: 'Prueba',
      isActive: true,
      isEmailVerified: true, // Pre-verified for testing
    },
  });

  // Crear categorías de ejemplo
  const categoryData = [
    {
      name: 'Curso de Cejas',
      slug: 'curso-cejas',
      description: 'Técnicas profesionales de diseño y microblading de cejas',
      image: 'https://images.unsplash.com/photo-1616394584738-fc6e612e71b9',
      order: 0,
      isActive: true,
      priceARS: 89999.99,
      priceUSD: 89.99,
      isFree: false,
    },
    {
      name: 'Curso de Pestañas',
      slug: 'curso-pestanas',
      description: 'Aprende extensiones de pestañas y técnicas de lifting',
      image: 'https://images.unsplash.com/photo-1583001315039-b15e03d87919',
      order: 1,
      isActive: true,
      priceARS: 79999.99,
      priceUSD: 79.99,
      isFree: false,
    },
    {
      name: 'Curso Avanzado Completo',
      slug: 'curso-avanzado-completo',
      description: 'Domina todas las técnicas avanzadas de micropigmentación',
      image: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e',
      order: 2,
      isActive: true,
      priceARS: 149999.99,
      priceUSD: 129.99,
      isFree: false,
    },
    {
      name: 'Introducción Gratuita',
      slug: 'introduccion-gratuita',
      description: 'Curso introductorio gratuito sobre micropigmentación',
      image: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f',
      order: 3,
      isActive: true,
      priceARS: 0,
      priceUSD: 0,
      isFree: true,
    },
  ];

  console.log('📚 Creando categorías de ejemplo...');
  for (const category of categoryData) {
    await prisma.videoCategory.upsert({
      where: { slug: category.slug },
      update: {},
      create: category,
    });
  }

  console.log('✅ Seed completado exitosamente!');
  console.log('👤 Usuarios creados:');
  console.log(`   Admin: admin@mery.com / admin123`);
  console.log(`   Subadmin: subadmin@mery.com / subadmin123`);
  console.log(`   User: user@mery.com / user123`);
  console.log('📚 Categorías creadas:');
  console.log(`   - Curso de Cejas ($89,999.99 ARS / $89.99 USD)`);
  console.log(`   - Curso de Pestañas ($79,999.99 ARS / $79.99 USD)`);
  console.log(`   - Curso Avanzado Completo ($149,999.99 ARS / $129.99 USD)`);
  console.log(`   - Introducción Gratuita (GRATIS)`);
}

main()
  .catch((e) => {
    console.error('❌ Error durante el seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
