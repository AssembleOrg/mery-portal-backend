-- Clases presenciales: fechas tentativas (admin), inscripción libre (1 activa
-- por alumna) y confirmación posterior con aviso por email + in-app.

CREATE TYPE "PresencialClassStatus" AS ENUM ('TENTATIVE', 'CONFIRMED', 'CANCELLED', 'COMPLETED');
CREATE TYPE "PresencialSignupStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED', 'COMPLETED');

CREATE TABLE "presencial_classes" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "startHour" INTEGER NOT NULL,
    "endHour" INTEGER NOT NULL,
    "status" "PresencialClassStatus" NOT NULL DEFAULT 'TENTATIVE',
    "restrictToStudents" BOOLEAN NOT NULL DEFAULT false,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "presencial_classes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "presencial_classes_startAt_idx" ON "presencial_classes"("startAt");
CREATE INDEX "presencial_classes_status_idx" ON "presencial_classes"("status");

CREATE TABLE "presencial_class_categories" (
    "classId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    CONSTRAINT "presencial_class_categories_pkey" PRIMARY KEY ("classId", "categoryId")
);
CREATE INDEX "presencial_class_categories_categoryId_idx" ON "presencial_class_categories"("categoryId");

CREATE TABLE "presencial_signups" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "PresencialSignupStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "presencial_signups_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "presencial_signups_classId_userId_key" ON "presencial_signups"("classId", "userId");
CREATE INDEX "presencial_signups_userId_idx" ON "presencial_signups"("userId");
CREATE INDEX "presencial_signups_status_idx" ON "presencial_signups"("status");

-- Máximo 1 inscripción activa por alumna. Las pasadas (COMPLETED por cron),
-- rechazadas y canceladas no cuentan.
CREATE UNIQUE INDEX "presencial_signups_active_user_key"
  ON "presencial_signups"("userId") WHERE "status" IN ('PENDING', 'CONFIRMED');

ALTER TABLE "presencial_class_categories" ADD CONSTRAINT "presencial_class_categories_classId_fkey"
  FOREIGN KEY ("classId") REFERENCES "presencial_classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "presencial_class_categories" ADD CONSTRAINT "presencial_class_categories_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "video_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "presencial_signups" ADD CONSTRAINT "presencial_signups_classId_fkey"
  FOREIGN KEY ("classId") REFERENCES "presencial_classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "presencial_signups" ADD CONSTRAINT "presencial_signups_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
