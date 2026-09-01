-- Aplica la promo 40% OFF (1/9 → 5/9 2026).
-- Guarda el precio actual en originalPrice* (snapshot) y baja el precio al 60%.
-- Idempotente: solo actúa si originalPrice* está NULL (no re-descuenta).
-- Excluye el centinela USD-only en ARS (99999999) y los precios en 0.
-- Rollback: scripts/rollback-promo-40.sql

BEGIN;

-- ARS (cursos en pesos)
UPDATE "video_categories"
SET "originalPriceARS" = "priceARS",
    "priceARS" = ROUND("priceARS" * 0.6)
WHERE "priceARS" IS NOT NULL
  AND "priceARS" > 0
  AND "priceARS" <> 99999999
  AND "originalPriceARS" IS NULL;

-- USD (cursos en dólares)
UPDATE "video_categories"
SET "originalPriceUSD" = "priceUSD",
    "priceUSD" = ROUND("priceUSD" * 0.6)
WHERE "priceUSD" IS NOT NULL
  AND "priceUSD" > 0
  AND "originalPriceUSD" IS NULL;

-- Carritos: reflejar el precio con descuento en los items ya agregados
UPDATE "cart_items" ci
SET "priceARS" = vc."priceARS",
    "priceUSD" = vc."priceUSD"
FROM "video_categories" vc
WHERE ci."categoryId" = vc."id";

COMMIT;
