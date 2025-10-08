#!/bin/bash

echo "🚀 Configurando base de datos para Mery Portal..."

# Generar cliente Prisma
echo "📦 Generando cliente Prisma..."
npx prisma generate

# Ejecutar migraciones
echo "🗄️ Ejecutando migraciones..."
npx prisma migrate dev --name init

echo "✅ Base de datos configurada exitosamente!"
echo "📚 Puedes ver la base de datos en: npx prisma studio"
