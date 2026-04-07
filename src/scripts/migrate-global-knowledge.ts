import fs from "node:fs/promises";
import path from "node:path";

import {
  DocumentOrigin,
  DocumentStatus,
  DocumentVisibility,
  Prisma,
} from "@prisma/client";

import prisma from "@/lib/prisma";
import {
  LEGACY_KNOWLEDGE_BASE_USER_ID,
  assertChunkMatchesDocumentOwnership,
  buildGlobalCorpusChunkOwnership,
  buildGlobalCorpusDocumentOwnership,
} from "@/utils/document-ownership.util";
import { getKnowledgeSourceMetadata } from "@/utils/knowledge-source.util";

type CorpusDocumentRow = {
  id: string;
  storagePath: string;
  userId: string | null;
  visibility: DocumentVisibility;
  origin: DocumentOrigin;
};

async function listKnowledgeSourceFiles(rootPath: string): Promise<string[]> {
  const entries = await fs.readdir(rootPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const nextPath = path.join(rootPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await listKnowledgeSourceFiles(nextPath)));
      continue;
    }

    if (/\.(docx|pdf)$/i.test(entry.name)) {
      files.push(nextPath);
    }
  }

  return files.sort((left, right) => left.localeCompare(right));
}

async function refreshDocumentStatuses(documentIds: string[]): Promise<void> {
  if (documentIds.length === 0) {
    return;
  }

  const pendingRows = await prisma.$queryRaw<
    Array<{ documentId: string; pendingCount: bigint }>
  >(
    Prisma.sql`
      SELECT
        dc."documentId" AS "documentId",
        COUNT(*) FILTER (WHERE dc."embedding" IS NULL) AS "pendingCount"
      FROM "document_chunks" dc
      WHERE dc."documentId" = ANY(${documentIds}::text[])
      GROUP BY dc."documentId"
    `,
  );

  for (const row of pendingRows) {
    await prisma.documents.update({
      where: {
        id: row.documentId,
      },
      data: {
        status:
          Number(row.pendingCount) === 0
            ? DocumentStatus.READY
            : DocumentStatus.PROCESSING,
      },
    });
  }
}

async function main() {
  const rootPath = path.resolve(process.cwd(), "knowledge_sources");
  const files = await listKnowledgeSourceFiles(rootPath);
  const corpusPaths = files.map((filePath) =>
    getKnowledgeSourceMetadata(rootPath, filePath).relativePath,
  );

  const documentOwnership = buildGlobalCorpusDocumentOwnership();
  const chunkOwnership = buildGlobalCorpusChunkOwnership();
  assertChunkMatchesDocumentOwnership(documentOwnership, chunkOwnership);

  const corpusDocuments = await prisma.documents.findMany({
    where: {
      storagePath: {
        in: corpusPaths,
      },
    },
    select: {
      id: true,
      storagePath: true,
      userId: true,
      visibility: true,
      origin: true,
    },
  });

  const documentsToMigrate = corpusDocuments.filter(
    (document) => document.userId === LEGACY_KNOWLEDGE_BASE_USER_ID,
  );
  const alreadyGlobalDocuments = corpusDocuments.filter(
    (document) =>
      document.userId === null &&
      document.visibility === DocumentVisibility.GLOBAL &&
      document.origin === DocumentOrigin.DEFAULT_CORPUS,
  );
  const skippedDocuments = corpusDocuments.filter(
    (document) =>
      document.userId !== LEGACY_KNOWLEDGE_BASE_USER_ID &&
      !(
        document.userId === null &&
        document.visibility === DocumentVisibility.GLOBAL &&
        document.origin === DocumentOrigin.DEFAULT_CORPUS
      ),
  );
  const documentIdsToMigrate = documentsToMigrate.map((document) => document.id);
  const chunkCountBefore =
    documentIdsToMigrate.length > 0
      ? await prisma.documentChunk.count({
          where: {
            documentId: {
              in: documentIdsToMigrate,
            },
          },
        })
      : 0;

  let migratedDocumentCount = 0;
  let migratedChunkCount = 0;

  if (documentIdsToMigrate.length > 0) {
    const migrationResult = await prisma.$transaction(async (tx) => {
      const documentUpdate = await tx.documents.updateMany({
        where: {
          id: {
            in: documentIdsToMigrate,
          },
        },
        data: documentOwnership,
      });

      const chunkUpdate = await tx.documentChunk.updateMany({
        where: {
          documentId: {
            in: documentIdsToMigrate,
          },
        },
        data: chunkOwnership,
      });

      return {
        migratedDocumentCount: documentUpdate.count,
        migratedChunkCount: chunkUpdate.count,
      };
    });

    migratedDocumentCount = migrationResult.migratedDocumentCount;
    migratedChunkCount = migrationResult.migratedChunkCount;

    await refreshDocumentStatuses(documentIdsToMigrate);

    const migratedDocumentsVerified = await prisma.documents.count({
      where: {
        id: {
          in: documentIdsToMigrate,
        },
        userId: null,
        visibility: DocumentVisibility.GLOBAL,
        origin: DocumentOrigin.DEFAULT_CORPUS,
      },
    });
    const migratedChunksVerified = await prisma.documentChunk.count({
      where: {
        documentId: {
          in: documentIdsToMigrate,
        },
        userId: null,
        visibility: DocumentVisibility.GLOBAL,
      },
    });

    if (migratedDocumentsVerified !== documentIdsToMigrate.length) {
      throw new Error("Document migration verification failed.");
    }

    if (migratedChunksVerified !== chunkCountBefore) {
      throw new Error("Chunk migration verification failed.");
    }
  }

  const documentMismatches = await prisma.documents.findMany({
    where: {
      storagePath: {
        in: corpusPaths,
      },
      OR: [
        {
          visibility: DocumentVisibility.PRIVATE,
          userId: null,
        },
        {
          visibility: DocumentVisibility.GLOBAL,
          NOT: {
            userId: null,
          },
        },
        {
          origin: DocumentOrigin.DEFAULT_CORPUS,
          OR: [
            {
              visibility: DocumentVisibility.PRIVATE,
            },
            {
              NOT: {
                userId: null,
              },
            },
          ],
        },
      ],
    },
    select: {
      id: true,
      storagePath: true,
      userId: true,
      visibility: true,
      origin: true,
    },
    take: 10,
  });

  const chunkMismatches = await prisma.$queryRaw<
    Array<{
      id: string;
      documentId: string;
      userId: string | null;
      visibility: DocumentVisibility;
      documentUserId: string | null;
      documentVisibility: DocumentVisibility;
    }>
  >(Prisma.sql`
    SELECT
      dc."id" AS id,
      dc."documentId" AS "documentId",
      dc."userId" AS "userId",
      dc."visibility" AS "visibility",
      d."userId" AS "documentUserId",
      d."visibility" AS "documentVisibility"
    FROM "document_chunks" dc
    INNER JOIN "documents" d ON d."id" = dc."documentId"
    WHERE d."storagePath" = ANY(${corpusPaths}::text[])
      AND (
        dc."visibility" <> d."visibility"
        OR dc."userId" IS DISTINCT FROM d."userId"
        OR (dc."visibility" = 'PRIVATE' AND dc."userId" IS NULL)
        OR (dc."visibility" = 'GLOBAL' AND dc."userId" IS NOT NULL)
      )
    LIMIT 10
  `);

  console.log(
    JSON.stringify(
      {
        success: true,
        mode: "migrate-global-knowledge",
        summary: {
          rootPath,
          discoveredCorpusPathCount: corpusPaths.length,
          matchedDocumentCount: corpusDocuments.length,
          migratedDocumentCount,
          migratedChunkCount,
          alreadyGlobalDocumentCount: alreadyGlobalDocuments.length,
          skippedDocumentCount: skippedDocuments.length,
          documentMismatchCount: documentMismatches.length,
          chunkMismatchCount: chunkMismatches.length,
        },
        mismatches: {
          documents: documentMismatches,
          chunks: chunkMismatches,
        },
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
