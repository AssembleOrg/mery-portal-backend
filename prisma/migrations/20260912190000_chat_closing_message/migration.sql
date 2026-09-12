-- Marca de idempotencia del mensaje de despedida del chat.
-- NULL = todavía no se envió (o el chat se reabrió / desbloqueó).
ALTER TABLE "chat_rooms" ADD COLUMN "closingMessageSentAt" TIMESTAMP(3);
