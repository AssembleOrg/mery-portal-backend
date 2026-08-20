-- Mentorías: disponibilidad + reservas.
CREATE TYPE "MentorshipStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED');

CREATE TABLE "mentorship_availability" (
    "id" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startMin" INTEGER NOT NULL,
    "endMin" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "mentorship_availability_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "mentorships" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "scheduledStart" TIMESTAMP(3) NOT NULL,
    "scheduledEnd" TIMESTAMP(3) NOT NULL,
    "status" "MentorshipStatus" NOT NULL DEFAULT 'SCHEDULED',
    "rescheduleCount" INTEGER NOT NULL DEFAULT 0,
    "meetingEmail" TEXT NOT NULL,
    "googleEventId" TEXT,
    "googleMeetLink" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "mentorships_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "mentorships_userId_idx" ON "mentorships"("userId");
CREATE INDEX "mentorships_categoryId_idx" ON "mentorships"("categoryId");
CREATE INDEX "mentorships_scheduledStart_idx" ON "mentorships"("scheduledStart");
CREATE INDEX "mentorships_status_idx" ON "mentorships"("status");

-- 1 sola persona por horario: solo cuenta la reserva vigente (SCHEDULED).
-- Índice único PARCIAL = protección a nivel DB contra race conditions.
CREATE UNIQUE INDEX "mentorships_active_slot_key"
  ON "mentorships"("scheduledStart") WHERE "status" = 'SCHEDULED';

-- 1 mentoría vigente por (alumno, curso). Cancelada no cuenta (permite rebook).
CREATE UNIQUE INDEX "mentorships_active_user_category_key"
  ON "mentorships"("userId", "categoryId")
  WHERE "status" IN ('SCHEDULED', 'COMPLETED');

ALTER TABLE "mentorships" ADD CONSTRAINT "mentorships_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mentorships" ADD CONSTRAINT "mentorships_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "video_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
