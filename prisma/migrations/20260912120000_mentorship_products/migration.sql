-- Productos pagos de mentoría / clase one-to-one, con variantes de precio
-- editables desde el admin, y créditos otorgados manualmente tras validar el pago.

-- Enums
CREATE TYPE "MentorshipProductType" AS ENUM ('MENTORSHIP', 'ONE_TO_ONE');
CREATE TYPE "MentorshipCreditStatus" AS ENUM ('AVAILABLE', 'USED');

-- Mentorship: distinguir gratis (creditId null) vs paga (creditId = crédito consumido)
ALTER TABLE "mentorships" ADD COLUMN "creditId" TEXT;

-- La mentoría gratis es 1 por CUENTA (no por curso) y las pagas suman extra, así
-- que se elimina el único parcial por (userId, categoryId). El límite de la gratis
-- se aplica en la app; el de horario sigue protegido por su índice de slot.
DROP INDEX IF EXISTS "mentorships_active_user_category_key";

-- Productos
CREATE TABLE "mentorship_products" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "MentorshipProductType" NOT NULL DEFAULT 'MENTORSHIP',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "mentorship_products_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "mentorship_products_categoryId_idx" ON "mentorship_products"("categoryId");
CREATE INDEX "mentorship_products_isActive_idx" ON "mentorship_products"("isActive");

-- Variantes de precio
CREATE TABLE "mentorship_price_variants" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "mentorship_price_variants_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "mentorship_price_variants_productId_idx" ON "mentorship_price_variants"("productId");

-- Créditos (validación manual)
CREATE TABLE "mentorship_credits" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT,
    "categoryId" TEXT,
    "type" "MentorshipProductType" NOT NULL DEFAULT 'MENTORSHIP',
    "amount" DECIMAL(10,2),
    "currency" TEXT,
    "note" TEXT,
    "status" "MentorshipCreditStatus" NOT NULL DEFAULT 'AVAILABLE',
    "mentorshipId" TEXT,
    "grantedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "mentorship_credits_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "mentorship_credits_userId_idx" ON "mentorship_credits"("userId");
CREATE INDEX "mentorship_credits_status_idx" ON "mentorship_credits"("status");
CREATE INDEX "mentorship_credits_categoryId_idx" ON "mentorship_credits"("categoryId");

-- FKs
ALTER TABLE "mentorship_products" ADD CONSTRAINT "mentorship_products_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "video_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "mentorship_price_variants" ADD CONSTRAINT "mentorship_price_variants_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "mentorship_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mentorship_credits" ADD CONSTRAINT "mentorship_credits_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mentorship_credits" ADD CONSTRAINT "mentorship_credits_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "mentorship_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
