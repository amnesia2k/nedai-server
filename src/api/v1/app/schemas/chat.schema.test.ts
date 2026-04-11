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

  it("accepts chatId with content", () => {
    const result = sendMessageSchema.parse({
      chatId: "4b3739f4-ed95-4ff2-a0b1-16f7910a45c4",
      content: "Use these docs",
    });

    expect(result.chatId).toBe("4b3739f4-ed95-4ff2-a0b1-16f7910a45c4");
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
});
