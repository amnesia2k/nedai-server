import { DocumentOrigin, DocumentStatus, DocumentVisibility } from "@prisma/client";
import { Pool } from "pg";

import prisma from "@/lib/prisma";
import EmbeddingService from "@/api/v1/services/embedding.service";
import DocumentParser from "@/api/v1/services/document-parser.service";
import DocumentStorage from "@/api/v1/services/document-storage.service";
import { env } from "@/utils/env";
import {
  chunkText,
  estimateTokenCount,
  sanitizeExtractedText,
  toVectorLiteral,
} from "@/utils/knowledge-source.util";

type PoolLike = Pick<Pool, "query" | "end">;

export class UserDocumentIngestionService {
  private readonly processingIds = new Set<string>();
  private readonly pool: PoolLike;

  constructor(pool?: PoolLike) {
    this.pool =
      pool ??
      new Pool({
        connectionString: env.DATABASE_URL,
      });
  }

  public queue(documentId: string) {
    if (this.processingIds.has(documentId)) {
      return;
    }

    this.processingIds.add(documentId);

    queueMicrotask(() => {
      void this.processDocument(documentId)
        .catch((error) => {
          console.error("[document-ingestion] failed", {
            documentId,
            error,
          });
        })
        .finally(() => {
          this.processingIds.delete(documentId);
        });
    });
  }

  public async processDocument(documentId: string) {
    const document = await prisma.documents.findUnique({
      where: { id: documentId },
    });

    if (
      !document ||
      document.visibility !== DocumentVisibility.PRIVATE ||
      document.origin !== DocumentOrigin.USER_UPLOAD ||
      !document.userId
    ) {
      return;
    }

    await prisma.documents.update({
      where: { id: documentId },
      data: {
        status: DocumentStatus.PROCESSING,
        processingError: null,
        chunkCount: 0,
      },
    });

    await prisma.documentChunk.deleteMany({
      where: { documentId },
    });

    try {
      const absolutePath = DocumentStorage.resolveAbsolutePath(document.storagePath);
      const extractedText = await DocumentParser.extractTextFromDocument(
        absolutePath,
        document.sourceType,
      );
      const normalizedText = sanitizeExtractedText(extractedText);
      const chunkTexts = chunkText(normalizedText);

      if (chunkTexts.length === 0) {
        throw new Error("No extractable text was found in this document");
      }

      const chunkIds = chunkTexts.map(() => crypto.randomUUID());
      const embeddings = await EmbeddingService.embedTexts(chunkTexts);

      await prisma.documentChunk.createMany({
        data: chunkTexts.map((text, index) => ({
          id: chunkIds[index],
          documentId,
          userId: document.userId,
          visibility: DocumentVisibility.PRIVATE,
          chunkIndex: index,
          text,
          tokenCount: estimateTokenCount(text),
          heading: document.title,
        })),
      });

      await this.updateChunkEmbeddings(
        chunkIds.map((id, index) => ({
          id,
          embedding: embeddings[index] ?? [],
        })),
      );

      await prisma.documents.update({
        where: { id: documentId },
        data: {
          status: DocumentStatus.READY,
          chunkCount: chunkTexts.length,
          processingError: null,
        },
      });
    } catch (error) {
      await prisma.documents.update({
        where: { id: documentId },
        data: {
          status: DocumentStatus.FAILED,
          chunkCount: 0,
          processingError:
            error instanceof Error
              ? error.message
              : "We could not process this document.",
        },
      });
    }
  }

  private async updateChunkEmbeddings(
    chunks: Array<{ id: string; embedding: number[] }>,
  ) {
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
}

const UserDocumentIngestion = new UserDocumentIngestionService();

export default UserDocumentIngestion;
