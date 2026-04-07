import fs from "node:fs/promises";
import path from "node:path";

import { DocumentStatus, DocumentVisibility } from "@prisma/client";
import mammoth from "mammoth";
import { Pool } from "pg";

import prisma from "@/lib/prisma";
import { env } from "@/utils/env";
import EmbeddingService from "@/api/v1/services/embedding.service";
import {
  assertChunkMatchesDocumentOwnership,
  buildGlobalCorpusChunkOwnership,
  buildGlobalCorpusDocumentOwnership,
} from "@/utils/document-ownership.util";
import {
  chunkText,
  estimateTokenCount,
  getKnowledgeSourceMetadata,
  sanitizeExtractedText,
  toVectorLiteral,
} from "@/utils/knowledge-source.util";
const DEFAULT_EMBEDDING_BATCH_SIZE = 8;

type PrepareKnowledgeSourcesOptions = {
  rootPath?: string;
  maxDocuments?: number;
  subject?: string;
  startAfter?: string;
  overwrite?: boolean;
};

type BackfillKnowledgeEmbeddingsOptions = {
  maxChunks?: number;
  batchSize?: number;
  subject?: string;
  startAfter?: string;
};

type IngestKnowledgeSourcesOptions = PrepareKnowledgeSourcesOptions &
  BackfillKnowledgeEmbeddingsOptions;

type PrepareKnowledgeSourcesSummary = {
  visibility: DocumentVisibility;
  discoveredCount: number;
  preparedCount: number;
  skippedCount: number;
  failedCount: number;
  chunkCount: number;
};

type BackfillKnowledgeEmbeddingsSummary = {
  visibility: DocumentVisibility;
  candidateCount: number;
  embeddedCount: number;
  touchedDocumentCount: number;
  lastProcessedPath: string | null;
};

type IngestionSummary = {
  visibility: DocumentVisibility;
  prepare: PrepareKnowledgeSourcesSummary;
  embed: BackfillKnowledgeEmbeddingsSummary;
};

type PendingChunkRow = {
  id: string;
  text: string;
  documentId: string;
  storagePath: string;
  chunkIndex: number;
};

class KnowledgeSourceIngestionService {
  private readonly pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: env.DATABASE_URL,
    });
  }

  public async ingestKnowledgeSources(
    options: IngestKnowledgeSourcesOptions = {},
  ): Promise<IngestionSummary> {
    const prepare = await this.prepareKnowledgeSources(options);
    const embed = await this.backfillKnowledgeEmbeddings(options);

    return {
      visibility: DocumentVisibility.GLOBAL,
      prepare,
      embed,
    };
  }

  public async prepareKnowledgeSources(
    options: PrepareKnowledgeSourcesOptions = {},
  ): Promise<PrepareKnowledgeSourcesSummary> {
    const rootPath =
      options.rootPath ?? path.resolve(process.cwd(), "knowledge_sources");
    const allFiles = await this.listKnowledgeSourceFiles(rootPath);
    const files = this.filterKnowledgeSourceFiles(rootPath, allFiles, {
      subject: options.subject,
      startAfter: options.startAfter,
      maxDocuments: options.maxDocuments,
    });
    const documentOwnership = buildGlobalCorpusDocumentOwnership();
    const chunkOwnership = buildGlobalCorpusChunkOwnership();

    assertChunkMatchesDocumentOwnership(documentOwnership, chunkOwnership);

    let preparedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    let chunkCount = 0;

    for (const filePath of files) {
      // Add a small delay for Neon connection stability
      await new Promise((resolve) => setTimeout(resolve, 100));

      const metadata = getKnowledgeSourceMetadata(rootPath, filePath);

      try {
        const existingDocument = await prisma.documents.findFirst({
          where: {
            storagePath: metadata.relativePath,
            visibility: DocumentVisibility.GLOBAL,
            origin: documentOwnership.origin,
          },
          select: {
            id: true,
          },
        });

        if (existingDocument && !options.overwrite) {
          skippedCount += 1;
          continue;
        }

        const extractedText = await this.extractText(filePath);
        const chunkTexts = chunkText(extractedText);

        if (existingDocument) {
          await prisma.documents.delete({
            where: {
              id: existingDocument.id,
            },
          });
        }

        const document = await prisma.documents.create({
          data: {
            ...documentOwnership,
            title: metadata.title,
            originalFilename: metadata.originalFilename,
            mimeType: metadata.mimeType,
            storagePath: metadata.relativePath,
            sourceType: metadata.sourceType,
            subject: metadata.subject,
            status:
              chunkTexts.length > 0
                ? DocumentStatus.PROCESSING
                : DocumentStatus.FAILED,
          },
        });

        if (chunkTexts.length === 0) {
          failedCount += 1;
          console.error(`No chunks generated for ${metadata.relativePath}`);
          continue;
        }

        await prisma.documentChunk.createMany({
          data: chunkTexts.map((text, index) => ({
            id: crypto.randomUUID(),
            documentId: document.id,
            ...chunkOwnership,
            chunkIndex: index,
            text,
            tokenCount: estimateTokenCount(text),
            heading: metadata.title,
          })),
        });

        preparedCount += 1;
        chunkCount += chunkTexts.length;

        console.log(
          `prepared ${metadata.relativePath} (${chunkTexts.length} chunks)`,
        );
      } catch (error) {
        failedCount += 1;
        console.error(`failed to prepare ${filePath}`);
        console.error(error);
      }
    }

    return {
      visibility: DocumentVisibility.GLOBAL,
      discoveredCount: files.length,
      preparedCount,
      skippedCount,
      failedCount,
      chunkCount,
    };
  }

  public async backfillKnowledgeEmbeddings(
    options: BackfillKnowledgeEmbeddingsOptions = {},
  ): Promise<BackfillKnowledgeEmbeddingsSummary> {
    const batchSize = Math.max(
      1,
      options.batchSize ?? DEFAULT_EMBEDDING_BATCH_SIZE,
    );
    let remainingChunks = Math.max(
      0,
      options.maxChunks ?? Number.MAX_SAFE_INTEGER,
    );

    const candidateCount = await this.countPendingChunks({
      subject: options.subject,
      startAfter: options.startAfter,
    });

    let embeddedCount = 0;
    let lastProcessedPath: string | null = null;
    const touchedDocumentIds = new Set<string>();

    while (remainingChunks > 0) {
      const pendingChunks = await this.getPendingChunks({
        subject: options.subject,
        startAfter: options.startAfter,
        limit: Math.min(batchSize, remainingChunks),
      });

      if (pendingChunks.length === 0) {
        break;
      }

      console.log(`Generating embeddings for ${pendingChunks.length} chunks...`);
      const embeddings = await this.createEmbeddings(
        pendingChunks.map((chunk) => chunk.text),
      );

      console.log(`Updating ${pendingChunks.length} chunks in database...`);
      await this.updateChunkEmbeddings(
        pendingChunks.map((chunk, index) => ({
          id: chunk.id,
          embedding: embeddings[index] ?? [],
        })),
      );

      for (const chunk of pendingChunks) {
        touchedDocumentIds.add(chunk.documentId);
        lastProcessedPath = chunk.storagePath;
      }

      embeddedCount += pendingChunks.length;
      remainingChunks -= pendingChunks.length;

      console.log(
        `embedded ${pendingChunks.length} chunks up to ${lastProcessedPath}`,
      );
    }

    if (touchedDocumentIds.size > 0) {
      await this.refreshDocumentStatuses(Array.from(touchedDocumentIds));
    }

    return {
      visibility: DocumentVisibility.GLOBAL,
      candidateCount,
      embeddedCount,
      touchedDocumentCount: touchedDocumentIds.size,
      lastProcessedPath,
    };
  }

  public async disconnect(): Promise<void> {
    await this.pool.end();
  }

  private async listKnowledgeSourceFiles(rootPath: string): Promise<string[]> {
    const entries = await fs.readdir(rootPath, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
      const nextPath = path.join(rootPath, entry.name);

      if (entry.isDirectory()) {
        files.push(...(await this.listKnowledgeSourceFiles(nextPath)));
        continue;
      }

      if (/\.(docx|pdf)$/i.test(entry.name)) {
        files.push(nextPath);
      }
    }

    return files.sort((left, right) => left.localeCompare(right));
  }

  private filterKnowledgeSourceFiles(
    rootPath: string,
    files: string[],
    options: {
      subject?: string;
      startAfter?: string;
      maxDocuments?: number;
    },
  ): string[] {
    const filtered = files.filter((filePath) => {
      const metadata = getKnowledgeSourceMetadata(rootPath, filePath);

      if (options.subject && metadata.subject !== options.subject) {
        return false;
      }

      if (options.startAfter && metadata.relativePath <= options.startAfter) {
        return false;
      }

      return true;
    });

    if (typeof options.maxDocuments === "number") {
      return filtered.slice(0, options.maxDocuments);
    }

    return filtered;
  }

  private async extractText(filePath: string): Promise<string> {
    if (filePath.toLowerCase().endsWith(".docx")) {
      const result = await mammoth.extractRawText({ path: filePath });
      return sanitizeExtractedText(result.value);
    }

    if (filePath.toLowerCase().endsWith(".pdf")) {
      const buffer = await fs.readFile(filePath);
      const pdfModule = await import("pdf-parse");
      const PDFParseClass =
        (pdfModule as any).PDFParse || (pdfModule as any).default?.PDFParse;
      const parser = new PDFParseClass({ data: buffer, verbosity: 0 });
      const result = await parser.getText();
      await parser.destroy();
      return sanitizeExtractedText(result.text);
    }

    return "";
  }

  private async createEmbeddings(textBatch: string[]): Promise<number[][]> {
    return EmbeddingService.embedTexts(textBatch);
  }

  private async countPendingChunks(options: {
    subject?: string;
    startAfter?: string;
  }): Promise<number> {
    const result = await this.pool.query<{ count: string }>(
      `
        SELECT COUNT(*)::text AS count
        FROM "document_chunks" dc
        JOIN "documents" d ON d."id" = dc."documentId"
        WHERE dc."visibility" = 'GLOBAL'
          AND dc."userId" IS NULL
          AND d."visibility" = 'GLOBAL'
          AND d."userId" IS NULL
          AND d."origin" = 'DEFAULT_CORPUS'
          AND dc."embedding" IS NULL
          AND ($1::text IS NULL OR d."subject" = $1)
          AND ($2::text IS NULL OR d."storagePath" > $2)
      `,
      [options.subject ?? null, options.startAfter ?? null],
    );

    return Number(result.rows[0]?.count ?? "0");
  }

  private async getPendingChunks(options: {
    subject?: string;
    startAfter?: string;
    limit: number;
  }): Promise<PendingChunkRow[]> {
    const result = await this.pool.query<PendingChunkRow>(
      `
        SELECT
          dc."id" AS id,
          dc."text" AS text,
          dc."documentId" AS "documentId",
          d."storagePath" AS "storagePath",
          dc."chunkIndex" AS "chunkIndex"
        FROM "document_chunks" dc
        JOIN "documents" d ON d."id" = dc."documentId"
        WHERE dc."visibility" = 'GLOBAL'
          AND dc."userId" IS NULL
          AND d."visibility" = 'GLOBAL'
          AND d."userId" IS NULL
          AND d."origin" = 'DEFAULT_CORPUS'
          AND dc."embedding" IS NULL
          AND ($1::text IS NULL OR d."subject" = $1)
          AND ($2::text IS NULL OR d."storagePath" > $2)
        ORDER BY d."storagePath" ASC, dc."chunkIndex" ASC
        LIMIT $3
      `,
      [options.subject ?? null, options.startAfter ?? null, options.limit],
    );

    return result.rows;
  }

  private async updateChunkEmbeddings(
    chunks: Array<{ id: string; embedding: number[] }>,
  ): Promise<void> {
    if (chunks.length === 0) {
      return;
    }

    const values: unknown[] = [];
    const rows = chunks.map((chunk, index) => {
      const base = index * 2;
      values.push(chunk.id, toVectorLiteral(chunk.embedding));
      return `($${base + 1}, $${base + 2}::vector)`;
    });

    await this.pool.query(
      `
        UPDATE "document_chunks" AS dc
        SET "embedding" = updates.embedding
        FROM (
          VALUES ${rows.join(", ")}
        ) AS updates(id, embedding)
        WHERE dc."id" = updates.id
      `,
      values,
    );
  }

  private async refreshDocumentStatuses(documentIds: string[]): Promise<void> {
    const result = await this.pool.query<{
      documentId: string;
      pendingCount: string;
    }>(
      `
        SELECT
          dc."documentId" AS "documentId",
          COUNT(*) FILTER (WHERE dc."embedding" IS NULL)::text AS "pendingCount"
        FROM "document_chunks" dc
        WHERE dc."documentId" = ANY($1::text[])
        GROUP BY dc."documentId"
      `,
      [documentIds],
    );

    for (const row of result.rows) {
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
}

const KnowledgeSourceIngestionServiceInstance =
  new KnowledgeSourceIngestionService();

export default KnowledgeSourceIngestionServiceInstance;
