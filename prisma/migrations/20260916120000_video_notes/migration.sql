-- Anotaciones de alumnas sobre un segundo puntual de cada video (diario de la formación).
CREATE TABLE "video_notes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "timeSeconds" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "video_notes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "video_notes_userId_categoryId_idx" ON "video_notes"("userId", "categoryId");
CREATE INDEX "video_notes_userId_videoId_timeSeconds_idx" ON "video_notes"("userId", "videoId", "timeSeconds");
CREATE INDEX "video_notes_videoId_idx" ON "video_notes"("videoId");

ALTER TABLE "video_notes" ADD CONSTRAINT "video_notes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "video_notes" ADD CONSTRAINT "video_notes_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "video_notes" ADD CONSTRAINT "video_notes_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "video_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
