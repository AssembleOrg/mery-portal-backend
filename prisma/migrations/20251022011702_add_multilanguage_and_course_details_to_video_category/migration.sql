-- AlterTable
ALTER TABLE "video_categories" ADD COLUMN     "includes_category" JSONB,
ADD COLUMN     "includes_category_en" JSONB,
ADD COLUMN     "learn" TEXT,
ADD COLUMN     "learn_en" TEXT,
ADD COLUMN     "long_description_en" TEXT,
ADD COLUMN     "modalidad" TEXT,
ADD COLUMN     "modalidad_en" TEXT,
ADD COLUMN     "target_en" TEXT;
