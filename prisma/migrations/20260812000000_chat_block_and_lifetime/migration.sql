-- Chat: reemplazo de tokens por bloqueo manual + vida útil del chat.
-- Las columnas de tokens quedan (deprecadas) para no perder historial.
ALTER TABLE "chat_rooms"
  ADD COLUMN "blocked" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "blockedAt" TIMESTAMP(3),
  ADD COLUMN "expiresAt" TIMESTAMP(3);
