-- Campañas de promo + cupones personales (cupón-regalo).
CREATE TABLE "promo_campaigns" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "rewardDiscountPercent" INTEGER,
    "rewardValidityDays" INTEGER NOT NULL DEFAULT 90,
    "rewardExcludeOwned" BOOLEAN NOT NULL DEFAULT true,
    "rewardsIssuedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "promo_campaigns_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "coupons"
  ADD COLUMN "userId" TEXT,
  ADD COLUMN "excludeOwnedCategories" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "sourceCampaignId" TEXT;

CREATE INDEX "coupons_userId_idx" ON "coupons"("userId");
CREATE INDEX "coupons_sourceCampaignId_idx" ON "coupons"("sourceCampaignId");

ALTER TABLE "coupons" ADD CONSTRAINT "coupons_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_sourceCampaignId_fkey"
  FOREIGN KEY ("sourceCampaignId") REFERENCES "promo_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
