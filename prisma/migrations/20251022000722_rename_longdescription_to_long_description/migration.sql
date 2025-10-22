/*
  Warnings:

  - You are about to drop the column `longdescription` on the `video_categories` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "video_categories" DROP COLUMN "longdescription",
ADD COLUMN     "long_description" TEXT;
