-- CreateEnum
CREATE TYPE "PresencialPollStatus" AS ENUM ('draft', 'open', 'closed');

-- CreateTable
CREATE TABLE "presencial_polls" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "PresencialPollStatus" NOT NULL DEFAULT 'draft',
    "deadlineAt" TIMESTAMP(3),
    "eligibility" JSONB NOT NULL DEFAULT '{"courseIds":[],"userOverrides":[]}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "presencial_polls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "presencial_poll_options" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 120,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "presencial_poll_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "presencial_votes" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT,
    "votedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "presencial_votes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "presencial_polls_status_idx" ON "presencial_polls"("status");

-- CreateIndex
CREATE INDEX "presencial_votes_pollId_idx" ON "presencial_votes"("pollId");

-- CreateIndex
CREATE INDEX "presencial_votes_optionId_idx" ON "presencial_votes"("optionId");

-- CreateIndex
CREATE UNIQUE INDEX "presencial_votes_pollId_userId_key" ON "presencial_votes"("pollId", "userId");

-- AddForeignKey
ALTER TABLE "presencial_poll_options" ADD CONSTRAINT "presencial_poll_options_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "presencial_polls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presencial_votes" ADD CONSTRAINT "presencial_votes_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "presencial_polls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presencial_votes" ADD CONSTRAINT "presencial_votes_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "presencial_poll_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presencial_votes" ADD CONSTRAINT "presencial_votes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

