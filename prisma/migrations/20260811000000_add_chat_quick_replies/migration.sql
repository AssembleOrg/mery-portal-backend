-- CreateTable: respuestas rápidas reutilizables del chat admin
CREATE TABLE "chat_quick_replies" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_quick_replies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chat_quick_replies_title_idx" ON "chat_quick_replies"("title");
