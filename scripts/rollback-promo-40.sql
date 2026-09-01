-- Rollback de la promo 40% OFF aplicada el 1/5/2026.
-- Ejecutar el 9/5/2026 a las 00:00 ART (cuando termina la promo).
--
-- Restaura los precios al valor previo al descuento usando el snapshot guardado
-- en originalPriceARS / originalPriceUSD.

BEGIN;

-- Restaurar ARS
UPDATE "video_categories"
SET "priceARS" = "originalPriceARS"
WHERE "originalPriceARS" IS NOT NULL;

-- Restaurar USD
UPDATE "video_categories"
SET "priceUSD" = "originalPriceUSD"
WHERE "originalPriceUSD" IS NOT NULL;

-- Limpiar los snapshots (la promo terminó)
UPDATE "video_categories"
SET "originalPriceARS" = NULL,
    "originalPriceUSD" = NULL
WHERE "originalPriceARS" IS NOT NULL
   OR "originalPriceUSD" IS NOT NULL;

COMMIT;
