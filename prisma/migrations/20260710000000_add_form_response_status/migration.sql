-- AlterTable: estado de decisión de acceso/invitación por respuesta
ALTER TABLE "form_responses" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "form_responses" ADD COLUMN "invitationSentAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "form_responses_formId_status_idx" ON "form_responses"("formId", "status");
