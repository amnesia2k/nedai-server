import { DocumentStatus } from "@prisma/client";
import { Pool } from "pg";

import EmbeddingService from "@/api/v1/services/embedding.service";
import { env } from "@/utils/env";
import { toVectorLiteral } from "@/utils/knowledge-source.util";
import { buildPrivateAndGlobalChunkAccessClause } from "@/utils/document-access.util";

type RetrievalRow = {
  chunkId: string;
  documentId: string;
  subject: string | null;
  lessonTitle: string | null;
  sourcePath: string;
  pageStart: number | null;
  pageEnd: number | null;
  heading: string | null;
  text: string;
  score: number | string;
};

type PoolLike = {
  query: (text: string, values?: unknown[]) => Promise<{ rows: RetrievalRow[] }>;
  end: () => Promise<void>;
};

export type RetrievedChunk = {
  chunkId: string;
  documentId: string;
  subject: string;
  lessonTitle: string;
  sourcePath: string;
  pageNumber?: number;
  heading?: string;
  pageStart?: number;
  pageEnd?: number;
  text: string;
  score: number;
};

type RetrievalOptions = {
  documentId?: string;
  documentIds?: string[];
};

type ChatRetrievalServiceOptions = {
  pool?: PoolLike;
  embedQuery?: (text: string) => Promise<number[]>;
  topK?: number;
  minScore?: number;
};

export class ChatRetrievalService {
  private readonly pool: PoolLike;
  private readonly embedQuery: (text: string) => Promise<number[]>;
  private readonly topK: number;
  private readonly minScore: number;

  constructor(options: ChatRetrievalServiceOptions = {}) {
    this.pool =
      options.pool ??
      new Pool({
        connectionString: env.DATABASE_URL,
      });
    this.embedQuery =
      options.embedQuery ?? ((text) => EmbeddingService.embedQuery(text));
    this.topK = Math.max(1, options.topK ?? env.CHAT_RETRIEVAL_TOP_K);
    this.minScore = options.minScore ?? env.CHAT_RETRIEVAL_MIN_SCORE;
  }

  public async retrieveRelevantChunks(
    userId: string,
    question: string,
    options: RetrievalOptions = {},
  ): Promise<RetrievedChunk[]> {
    const queryEmbedding = await this.embedQuery(question);
    const accessClause = buildPrivateAndGlobalChunkAccessClause("$1", "dc");
    const vectorLiteral = toVectorLiteral(queryEmbedding);
    const queryValues: unknown[] = [
      userId,
      vectorLiteral,
      DocumentStatus.READY,
      this.topK,
    ];
    const documentFilter = options.documentId
      ? `\n          AND dc."documentId" = $${queryValues.push(options.documentId)}`
      : options.documentIds?.length
        ? `\n          AND dc."documentId" = ANY($${queryValues.push(options.documentIds)})`
        : "";
    const result = (await this.pool.query(
      `
        SELECT
          dc."id" AS "chunkId",
          dc."documentId" AS "documentId",
          d."subject" AS "subject",
          COALESCE(dc."heading", d."title") AS "lessonTitle",
          d."storagePath" AS "sourcePath",
          dc."pageStart" AS "pageStart",
          dc."pageEnd" AS "pageEnd",
          dc."heading" AS "heading",
          dc."text" AS "text",
          1 - (dc."embedding" <=> $2::vector) AS "score"
        FROM "document_chunks" dc
        JOIN "documents" d ON d."id" = dc."documentId"
        WHERE dc."embedding" IS NOT NULL
          AND d."status" = $3
          AND ${accessClause}
          ${documentFilter}
        ORDER BY dc."embedding" <=> $2::vector ASC
        LIMIT $4
      `,
      queryValues,
    )) as { rows: RetrievalRow[] };

    return result.rows
      .map((row) => {
        const score = Number(row.score);

        return {
          chunkId: row.chunkId,
          documentId: row.documentId,
          subject: row.subject ?? "General",
          lessonTitle: row.lessonTitle ?? "Untitled lesson",
          sourcePath: row.sourcePath,
          pageNumber: row.pageStart ?? undefined,
          heading: row.heading ?? undefined,
          pageStart: row.pageStart ?? undefined,
          pageEnd: row.pageEnd ?? undefined,
          text: row.text,
          score,
        } satisfies RetrievedChunk;
      })
      .filter((row) => row.score >= this.minScore);
  }

  public async disconnect() {
    await this.pool.end();
  }
}

const ChatRetrievalServiceInstance = new ChatRetrievalService();

export default ChatRetrievalServiceInstance;
