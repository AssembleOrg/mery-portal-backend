-- AlterTable
ALTER TABLE "videos" DROP COLUMN "slug";

-- DropIndex
DROP INDEX IF EXISTS "videos_slug_key";

