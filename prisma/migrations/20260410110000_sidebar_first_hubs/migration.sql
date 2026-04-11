-- AlterEnum
ALTER TYPE "SourceType" ADD VALUE IF NOT EXISTS 'DOC';

-- CreateEnum
CREATE TYPE "StudyPlanMode" AS ENUM ('STUDENT_DAILY', 'LECTURER_SEMESTER');

-- CreateEnum
CREATE TYPE "StudyPlanStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "StudyBlockStatus" AS ENUM ('PENDING', 'COMPLETED', 'SKIPPED');

-- AlterTable
ALTER TABLE "users"
  ADD COLUMN "preferredName" TEXT,
  ADD COLUMN "aboutMe" TEXT,
  ADD COLUMN "likes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "dislikes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "learningPreferences" JSONB,
  ADD COLUMN "department" TEXT,
  ADD COLUMN "matricNumber" TEXT,
  ADD COLUMN "staffId" TEXT;

-- AlterTable
ALTER TABLE "documents"
  ADD COLUMN "byteSize" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "contentHash" TEXT,
  ADD COLUMN "chunkCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "processingError" TEXT;

-- CreateTable
CREATE TABLE "study_plans" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "mode" "StudyPlanMode" NOT NULL,
  "title" TEXT NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "status" "StudyPlanStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "study_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "study_blocks" (
  "id" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "scheduledDate" TIMESTAMP(3) NOT NULL,
  "startTime" TEXT,
  "endTime" TEXT,
  "status" "StudyBlockStatus" NOT NULL DEFAULT 'PENDING',
  "orderIndex" INTEGER NOT NULL,
  "sourceDocumentIds" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "study_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "documents_userId_contentHash_idx" ON "documents"("userId", "contentHash");

-- CreateIndex
CREATE UNIQUE INDEX "documents_userId_contentHash_unique_private"
ON "documents"("userId", "contentHash")
WHERE "userId" IS NOT NULL AND "contentHash" IS NOT NULL;

-- CreateIndex
CREATE INDEX "study_plans_userId_status_idx" ON "study_plans"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "study_plans_single_active_idx"
ON "study_plans"("userId")
WHERE "status" = 'ACTIVE';

-- CreateIndex
CREATE INDEX "study_blocks_planId_scheduledDate_idx" ON "study_blocks"("planId", "scheduledDate");

-- AddForeignKey
ALTER TABLE "study_plans"
  ADD CONSTRAINT "study_plans_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_blocks"
  ADD CONSTRAINT "study_blocks_planId_fkey"
  FOREIGN KEY ("planId") REFERENCES "study_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
