import { describe, expect, it } from "bun:test";
import type { Chat } from "@prisma/client";

import { serializeChat } from "@/api/v1/serializers/chat.serializer";

describe("serializeChat", () => {
  it("maps updatedAt to lastMessageAt", () => {
    const chat = {
      id: "chat-1",
      userId: "user-1",
      title: "Physics",
      createdAt: new Date("2026-04-07T08:00:00.000Z"),
      updatedAt: new Date("2026-04-07T08:05:00.000Z"),
    } satisfies Chat;

    expect(serializeChat(chat)).toEqual({
      id: "chat-1",
      title: "Physics",
      createdAt: "2026-04-07T08:00:00.000Z",
      updatedAt: "2026-04-07T08:05:00.000Z",
      lastMessageAt: "2026-04-07T08:05:00.000Z",
    });
  });
});
