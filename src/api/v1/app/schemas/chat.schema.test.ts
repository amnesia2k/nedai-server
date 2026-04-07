import { describe, expect, it } from "bun:test";

import { sendMessageSchema } from "@/api/v1/app/schemas/chat.schema";

describe("chat schema validation", () => {
  it("accepts a valid content-only payload", () => {
    const result = sendMessageSchema.parse({
      content: "Explain momentum",
    });

    expect(result).toMatchObject({
      content: "Explain momentum",
    });
  });

  it("accepts chatId with documentIds", () => {
    const result = sendMessageSchema.parse({
      chatId: "4b3739f4-ed95-4ff2-a0b1-16f7910a45c4",
      content: "Use these docs",
      documentIds: ["9917bda1-c6d6-4c27-bf26-f1dd2b76488f"],
    });

    expect(result.chatId).toBe("4b3739f4-ed95-4ff2-a0b1-16f7910a45c4");
    expect(result.documentIds).toEqual([
      "9917bda1-c6d6-4c27-bf26-f1dd2b76488f",
    ]);
  });

  it("trims content", () => {
    const result = sendMessageSchema.parse({
      content: "   Explain acceleration   ",
    });

    expect(result.content).toBe("Explain acceleration");
  });

  it("rejects empty content", () => {
    expect(() =>
      sendMessageSchema.parse({
        content: "   ",
      }),
    ).toThrow("Message content is required");
  });

  it("rejects invalid uuids", () => {
    expect(() =>
      sendMessageSchema.parse({
        chatId: "bad-id",
        content: "Explain force",
      }),
    ).toThrow("Chat ID must be a valid UUID");
  });

  it("dedupes repeated documentIds", () => {
    const documentId = "c9329456-1b99-4c22-84d6-870bff0a6585";
    const result = sendMessageSchema.parse({
      content: "Explain pressure",
      documentIds: [documentId, documentId],
    });

    expect(result.documentIds).toEqual([documentId]);
  });
});
