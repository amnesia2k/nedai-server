import { describe, expect, it, mock } from "bun:test";

import { ChatRetrievalService } from "@/api/v1/services/chat-retrieval.service";

describe("ChatRetrievalService", () => {
  it("retrieves across all accessible docs by default and filters weak matches", async () => {
    const query = mock(async () => ({
      rows: [
        {
          chunkId: "chunk-1",
          documentId: "doc-1",
          subject: "Physics",
          lessonTitle: "Motion",
          sourcePath: "Physics/Motion.docx",
          pageStart: 4,
          pageEnd: 5,
          heading: "Motion",
          text: "Speed describes how fast an object moves.",
          score: "0.82",
        },
        {
          chunkId: "chunk-2",
          documentId: "doc-2",
          subject: "Physics",
          lessonTitle: "Friction",
          sourcePath: "Physics/Friction.docx",
          pageStart: null,
          pageEnd: null,
          heading: null,
          text: "Friction opposes motion.",
          score: "0.11",
        },
      ],
    }));
    const service = new ChatRetrievalService({
      pool: {
        query,
        end: mock(async () => {}),
      },
      embedQuery: mock(async () => [0.1, 0.2, 0.3]),
      topK: 5,
      minScore: 0.2,
    });

    const result = await service.retrieveRelevantChunks(
      "user-1",
      "Explain speed",
    );
    const [queryText, queryValues] = (query as any).mock.calls[0];

    expect(query).toHaveBeenCalledTimes(1);
    expect(queryText).toContain(`dc."userId" = $1`);
    expect(queryText).toContain(`dc."userId" IS NULL`);
    expect(queryValues).toEqual([
      "user-1",
      "[0.1,0.2,0.3]",
      "READY",
      5,
    ]);
    expect(result).toEqual([
      {
        chunkId: "chunk-1",
        documentId: "doc-1",
        subject: "Physics",
        lessonTitle: "Motion",
        sourcePath: "Physics/Motion.docx",
        pageNumber: 4,
        heading: "Motion",
        pageStart: 4,
        pageEnd: 5,
        text: "Speed describes how fast an object moves.",
        score: 0.82,
      },
    ]);
  });

  it("always retrieves across all accessible documents", async () => {
    const query = mock(async () => ({
      rows: [],
    }));
    const service = new ChatRetrievalService({
      pool: {
        query,
        end: mock(async () => {}),
      },
      embedQuery: mock(async () => [1, 2, 3]),
      topK: 3,
      minScore: 0.2,
    });

    await service.retrieveRelevantChunks("user-1", "Explain force");
    const [queryText, queryValues] = (query as any).mock.calls[0];

    expect(queryText).not.toContain(`d."visibility" = 'GLOBAL'`);
    expect(queryValues).toEqual(["user-1", "[1,2,3]", "READY", 3]);
  });

  it("restricts retrieval to the selected document when provided", async () => {
    const query = mock(async () => ({
      rows: [],
    }));
    const service = new ChatRetrievalService({
      pool: {
        query,
        end: mock(async () => {}),
      },
      embedQuery: mock(async () => [1, 2, 3]),
      topK: 3,
      minScore: 0.2,
    });

    await service.retrieveRelevantChunks("user-1", "Explain force", {
      documentId: "doc-9",
    });
    const [queryText, queryValues] = (query as any).mock.calls[0];

    expect(queryText).toContain(`dc."documentId" = $5`);
    expect(queryValues).toEqual(["user-1", "[1,2,3]", "READY", 3, "doc-9"]);
  });

  it("uses per-call topK and minScore overrides", async () => {
    const query = mock(async () => ({
      rows: [
        {
          chunkId: "chunk-1",
          documentId: "doc-9",
          subject: null,
          lessonTitle: "Application Form",
          sourcePath: "uploads/user-1/form.pdf",
          pageStart: 1,
          pageEnd: 1,
          heading: "Application Form",
          text: "Personal details section of the form.",
          score: "0.25",
        },
      ],
    }));
    const service = new ChatRetrievalService({
      pool: {
        query,
        end: mock(async () => {}),
      },
      embedQuery: mock(async () => [1, 2, 3]),
      topK: 5,
      minScore: 0.5,
    });

    const result = await service.retrieveRelevantChunks(
      "user-1",
      "summarize this document",
      { documentId: "doc-9", topK: 15, minScore: 0.1 },
    );
    const [, queryValues] = (query as any).mock.calls[0];

    expect(queryValues[3]).toBe(15);
    expect(result).toHaveLength(1);
    expect(result[0].score).toBe(0.25);
  });
});
