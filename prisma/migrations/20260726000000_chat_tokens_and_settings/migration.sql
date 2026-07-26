-- AlterTable: tokens en las salas de chat
ALTER TABLE "chat_rooms" ADD COLUMN     "tokens" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "tokensBlockedAt" TIMESTAMP(3);

-- CreateTable: historial de tokens marcados por el admin
CREATE TABLE "chat_token_events" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_token_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chat_token_events_roomId_createdAt_idx" ON "chat_token_events"("roomId", "createdAt");

-- AddForeignKey
ALTER TABLE "chat_token_events" ADD CONSTRAINT "chat_token_events_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "chat_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_token_events" ADD CONSTRAINT "chat_token_events_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: configuración key/value editable desde el panel admin
CREATE TABLE "app_settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key")
);

-- Seed del límite de tokens del chat
INSERT INTO "app_settings" ("key", "value", "description", "updatedAt")
VALUES ('chat.tokenLimit', '3', 'Cantidad de tokens que bloquean el chat de un alumno', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
