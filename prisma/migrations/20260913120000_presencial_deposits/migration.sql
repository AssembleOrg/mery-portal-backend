-- Estado de la seña de una inscripción a clase presencial.
CREATE TYPE "PresencialDepositStatus" AS ENUM ('NONE', 'PENDING', 'PAID', 'FAILED');

-- Listado de señas editable desde el admin.
CREATE TABLE "presencial_prices" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amountUSD" DECIMAL(10,2),
    "amountARS" DECIMAL(10,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "presencial_prices_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "presencial_classes" ADD COLUMN "priceId" TEXT;
ALTER TABLE "presencial_classes"
    ADD CONSTRAINT "presencial_classes_priceId_fkey"
    FOREIGN KEY ("priceId") REFERENCES "presencial_prices"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "presencial_signups"
    ADD COLUMN "disclaimerAcceptedAt" TIMESTAMP(3),
    ADD COLUMN "depositStatus" "PresencialDepositStatus" NOT NULL DEFAULT 'NONE',
    ADD COLUMN "depositAmountARS" DECIMAL(10,2),
    ADD COLUMN "depositAmountUSD" DECIMAL(10,2),
    ADD COLUMN "depositRate" DECIMAL(10,2),
    ADD COLUMN "mpPreferenceId" TEXT,
    ADD COLUMN "mpPaymentId" TEXT,
    ADD COLUMN "depositPaidAt" TIMESTAMP(3);

CREATE INDEX "presencial_signups_mpPaymentId_idx" ON "presencial_signups"("mpPaymentId");
