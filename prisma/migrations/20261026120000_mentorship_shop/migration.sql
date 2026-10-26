-- Tienda de mentorías: packs, promos, órdenes y vencimiento/regalo de créditos.
-- Solo agrega tablas y columnas (nullable o con default): no toca datos existentes.

-- CreateEnum
CREATE TYPE "MentorshipPromoKind" AS ENUM ('BUY_X_PAY_Y', 'PERCENT');

-- CreateEnum
CREATE TYPE "MentorshipOrderStatus" AS ENUM ('PENDING', 'PAID', 'CANCELLED', 'REJECTED');

-- CreateEnum
CREATE TYPE "MentorshipPaymentMethod" AS ENUM ('MERCADOPAGO', 'TRANSFER', 'CASH', 'FOREIGN');

-- CreateEnum
CREATE TYPE "MentorshipOrderItemKind" AS ENUM ('PRODUCT', 'PACK');

-- AlterTable
ALTER TABLE "mentorship_products" ADD COLUMN     "shopDurationMin" INTEGER,
ADD COLUMN     "shopEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "shopImageUrl" TEXT,
ADD COLUMN     "shopOnly" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "shopPriceARS" DECIMAL(12,2),
ADD COLUMN     "shopPriceUSD" DECIMAL(12,2),
ADD COLUMN     "shopTagline" TEXT;

-- AlterTable
ALTER TABLE "mentorship_credits" ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "giftedAt" TIMESTAMP(3),
ADD COLUMN     "giftedFromUserId" TEXT,
ADD COLUMN     "orderId" TEXT;

-- CreateTable
CREATE TABLE "mentorship_packs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "tagline" TEXT,
    "imageUrl" TEXT,
    "priceARS" DECIMAL(12,2),
    "priceUSD" DECIMAL(12,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mentorship_packs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mentorship_pack_items" (
    "id" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "mentorship_pack_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mentorship_promos" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "MentorshipPromoKind" NOT NULL,
    "buyQty" INTEGER,
    "payQty" INTEGER,
    "percent" INTEGER,
    "code" TEXT,
    "appliesToAll" BOOLEAN NOT NULL DEFAULT true,
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "maxUses" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mentorship_promos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mentorship_promo_products" (
    "id" TEXT NOT NULL,
    "promoId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,

    CONSTRAINT "mentorship_promo_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mentorship_orders" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "MentorshipOrderStatus" NOT NULL DEFAULT 'PENDING',
    "paymentMethod" "MentorshipPaymentMethod" NOT NULL,
    "currency" TEXT NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "promoId" TEXT,
    "promoLabel" TEXT,
    "mpPreferenceId" TEXT,
    "mpPaymentId" TEXT,
    "paidAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mentorship_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mentorship_order_items" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "kind" "MentorshipOrderItemKind" NOT NULL,
    "productId" TEXT,
    "packId" TEXT,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "lineTotal" DECIMAL(12,2) NOT NULL,
    "contents" JSONB NOT NULL,

    CONSTRAINT "mentorship_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mentorship_packs_isActive_idx" ON "mentorship_packs"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "mentorship_pack_items_packId_productId_key" ON "mentorship_pack_items"("packId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "mentorship_promos_code_key" ON "mentorship_promos"("code");

-- CreateIndex
CREATE INDEX "mentorship_promos_isActive_idx" ON "mentorship_promos"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "mentorship_promo_products_promoId_productId_key" ON "mentorship_promo_products"("promoId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "mentorship_orders_number_key" ON "mentorship_orders"("number");

-- CreateIndex
CREATE UNIQUE INDEX "mentorship_orders_mpPaymentId_key" ON "mentorship_orders"("mpPaymentId");

-- CreateIndex
CREATE INDEX "mentorship_orders_userId_idx" ON "mentorship_orders"("userId");

-- CreateIndex
CREATE INDEX "mentorship_orders_status_idx" ON "mentorship_orders"("status");

-- CreateIndex
CREATE INDEX "mentorship_order_items_orderId_idx" ON "mentorship_order_items"("orderId");

-- CreateIndex
CREATE INDEX "mentorship_credits_orderId_idx" ON "mentorship_credits"("orderId");

-- AddForeignKey
ALTER TABLE "mentorship_credits" ADD CONSTRAINT "mentorship_credits_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "mentorship_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentorship_pack_items" ADD CONSTRAINT "mentorship_pack_items_packId_fkey" FOREIGN KEY ("packId") REFERENCES "mentorship_packs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentorship_pack_items" ADD CONSTRAINT "mentorship_pack_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "mentorship_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentorship_promo_products" ADD CONSTRAINT "mentorship_promo_products_promoId_fkey" FOREIGN KEY ("promoId") REFERENCES "mentorship_promos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentorship_promo_products" ADD CONSTRAINT "mentorship_promo_products_productId_fkey" FOREIGN KEY ("productId") REFERENCES "mentorship_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentorship_orders" ADD CONSTRAINT "mentorship_orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentorship_orders" ADD CONSTRAINT "mentorship_orders_promoId_fkey" FOREIGN KEY ("promoId") REFERENCES "mentorship_promos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentorship_order_items" ADD CONSTRAINT "mentorship_order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "mentorship_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentorship_order_items" ADD CONSTRAINT "mentorship_order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "mentorship_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentorship_order_items" ADD CONSTRAINT "mentorship_order_items_packId_fkey" FOREIGN KEY ("packId") REFERENCES "mentorship_packs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

