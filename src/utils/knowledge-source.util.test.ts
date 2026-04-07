import { describe, expect, it } from "bun:test";

import {
  chunkText,
  estimateTokenCount,
  getKnowledgeSourceMetadata,
  sanitizeExtractedText,
  toVectorLiteral,
} from "@/utils/knowledge-source.util";

describe("knowledge-source utils", () => {
  it("sanitizes extracted text without removing paragraph boundaries", () => {
    expect(sanitizeExtractedText("Hello   world\r\n\r\n\r\nNext\u0000 line")).toBe("Hello world\n\nNext line");
  });

  it("chunks text with overlap", () => {
    const chunks = chunkText("abcdefghijklmnopqrstuvwxyz", 10, 3);

    expect(chunks).toEqual(["abcdefghij", "hijklmnopq", "opqrstuvwx", "vwxyz"]);
  });

  it("estimates token count from character length", () => {
    expect(estimateTokenCount("abcdefgh")).toBe(2);
    expect(estimateTokenCount("a")).toBe(1);
  });

  it("derives metadata from knowledge-source file paths", () => {
    expect(
      getKnowledgeSourceMetadata(
        "C:/repo/knowledge_sources",
        "C:/repo/knowledge_sources/Accounting/Lesson 1-Intro.docx",
      ),
    ).toEqual({
      relativePath: "Accounting/Lesson 1-Intro.docx",
      subject: "Accounting",
      title: "Lesson 1-Intro",
      originalFilename: "Lesson 1-Intro.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      sourceType: "DOCX",
    });
  });

  it("serializes embeddings into pgvector literal format", () => {
    expect(toVectorLiteral([0.25, -1, 3.5])).toBe("[0.25,-1,3.5]");
  });
});
