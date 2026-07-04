-- AlterTable: agregar columnas de snapshot del precio previo a la promo
ALTER TABLE "video_categories"
  ADD COLUMN "originalPriceARS" DECIMAL(10,2),
  ADD COLUMN "originalPriceUSD" DECIMAL(10,2);

-- Snapshot ARS: todos los cursos con precio ARS, EXCEPTO Nanoblading y Camuflaje Senior
UPDATE "video_categories"
SET "originalPriceARS" = "priceARS"
WHERE "deletedAt" IS NULL
  AND "isFree" = false
  AND "priceARS" > 0
  AND name NOT ILIKE '%nanoblading%'
  AND slug NOT ILIKE '%nanoblading%'
  AND name NOT ILIKE '%camuflaje senior%'
  AND slug NOT ILIKE '%camuflaje-senior%'
  AND name NOT ILIKE '%camuflaje señor%'
  AND slug NOT ILIKE '%camuflaje-senor%';

-- Aplicar 40% de descuento real al priceARS de los cursos snapshot-ados
UPDATE "video_categories"
SET "priceARS" = ROUND("originalPriceARS" * 0.6, 2)
WHERE "originalPriceARS" IS NOT NULL;

-- Snapshot USD: SOLO Nanoblading y Camuflaje Senior
UPDATE "video_categories"
SET "originalPriceUSD" = "priceUSD"
WHERE "deletedAt" IS NULL
  AND "isFree" = false
  AND "priceUSD" > 0
  AND (
       name ILIKE '%nanoblading%'
    OR slug ILIKE '%nanoblading%'
    OR name ILIKE '%camuflaje senior%'
    OR slug ILIKE '%camuflaje-senior%'
    OR name ILIKE '%camuflaje señor%'
    OR slug ILIKE '%camuflaje-senor%'
  );

-- Aplicar 40% de descuento real al priceUSD de los cursos snapshot-ados
UPDATE "video_categories"
SET "priceUSD" = ROUND("originalPriceUSD" * 0.6, 2)
WHERE "originalPriceUSD" IS NOT NULL;
