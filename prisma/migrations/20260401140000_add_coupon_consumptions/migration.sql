-- CreateTable
CREATE TABLE "coupon_consumptions" (
    "id" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "preferenceId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "consumedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),

    CONSTRAINT "coupon_consumptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "coupon_consumptions_status_expiresAt_idx" ON "coupon_consumptions"("status", "expiresAt");

-- AddForeignKey
ALTER TABLE "coupon_consumptions" ADD CONSTRAINT "coupon_consumptions_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "coupons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
