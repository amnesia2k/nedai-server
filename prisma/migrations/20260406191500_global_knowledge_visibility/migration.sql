-- CreateEnum
CREATE TYPE "DocumentVisibility" AS ENUM ('PRIVATE', 'GLOBAL');

-- CreateEnum
CREATE TYPE "DocumentOrigin" AS ENUM ('USER_UPLOAD', 'DEFAULT_CORPUS');

-- AlterTable
ALTER TABLE "documents"
  ALTER COLUMN "userId" DROP NOT NULL,
  ADD COLUMN "visibility" "DocumentVisibility" NOT NULL DEFAULT 'PRIVATE',
  ADD COLUMN "origin" "DocumentOrigin" NOT NULL DEFAULT 'USER_UPLOAD';

-- AlterTable
ALTER TABLE "document_chunks"
  ALTER COLUMN "userId" DROP NOT NULL,
  ADD COLUMN "visibility" "DocumentVisibility" NOT NULL DEFAULT 'PRIVATE';

-- Align the persisted vector column with the local embedding model used in code.
ALTER TABLE "document_chunks"
  ALTER COLUMN "embedding" TYPE vector(384);

-- CreateIndex
CREATE INDEX "documents_visibility_idx" ON "documents"("visibility");

-- CreateIndex
CREATE INDEX "documents_subject_visibility_idx" ON "documents"("subject", "visibility");

-- CreateIndex
CREATE INDEX "documents_userId_visibility_idx" ON "documents"("userId", "visibility");

-- CreateIndex
CREATE INDEX "document_chunks_visibility_idx" ON "document_chunks"("visibility");

-- CreateIndex
CREATE INDEX "document_chunks_userId_visibility_idx" ON "document_chunks"("userId", "visibility");

-- CreateIndex
CREATE INDEX "document_chunks_documentId_visibility_idx" ON "document_chunks"("documentId", "visibility");
