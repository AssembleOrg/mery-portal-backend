-- Se elimina el sistema de campañas de promo. Se conservan los campos de
-- cupón personal (userId, excludeOwnedCategories), usados por el cupón-regalo
-- que ahora se emite en cada compra.
ALTER TABLE "coupons" DROP CONSTRAINT IF EXISTS "coupons_sourceCampaignId_fkey";
DROP INDEX IF EXISTS "coupons_sourceCampaignId_idx";
ALTER TABLE "coupons" DROP COLUMN IF EXISTS "sourceCampaignId";
DROP TABLE IF EXISTS "promo_campaigns";
