import { describe, expect, it } from "bun:test";
import type { Message } from "@prisma/client";

import { serializeMessage } from "@/api/v1/serializers/message.serializer";

describe("serializeMessage", () => {
  it("maps roles to lowercase", () => {
    const message = {
      id: "message-1",
      chatId: "chat-1",
      role: "USER",
      content: "Explain speed",
      citationsJson: null,
      createdAt: new Date("2026-04-07T08:00:00.000Z"),
    } satisfies Message;

    expect(serializeMessage(message) as any).toEqual({
      id: "message-1",
      chatId: "chat-1",
      role: "user",
      content: "Explain speed",
      createdAt: "2026-04-07T08:00:00.000Z",
    });
  });

  it("exposes assistant metadata from citationsJson", () => {
    const message = {
      id: "message-2",
      chatId: "chat-1",
      role: "ASSISTANT",
      content: "Speed is distance over time.",
      citationsJson: {
        grounded: true,
        usedGeneralKnowledge: false,
        sources: [
          {
            subject: "Physics",
            lessonTitle: "Motion",
            sourcePath: "Physics/Motion.docx",
            pageNumber: 2,
          },
        ],
      },
      createdAt: new Date("2026-04-07T08:01:00.000Z"),
    } satisfies Message;

    expect(serializeMessage(message) as any).toEqual({
      id: "message-2",
      chatId: "chat-1",
      role: "assistant",
      content: "Speed is distance over time.",
      createdAt: "2026-04-07T08:01:00.000Z",
      grounded: true,
      usedGeneralKnowledge: false,
      sources: [
        {
          subject: "Physics",
          lessonTitle: "Motion",
          sourcePath: "Physics/Motion.docx",
          pageNumber: 2,
        },
      ],
    });
  });

  it("omits assistant-only fields for user messages", () => {
    const message = {
      id: "message-3",
      chatId: "chat-1",
      role: "USER",
      content: "What is velocity?",
      citationsJson: {
        grounded: true,
      },
      createdAt: new Date("2026-04-07T08:02:00.000Z"),
    } satisfies Message;

    expect(serializeMessage(message) as any).toEqual({
      id: "message-3",
      chatId: "chat-1",
      role: "user",
      content: "What is velocity?",
      createdAt: "2026-04-07T08:02:00.000Z",
    });
  });

  it("handles malformed citationsJson defensively", () => {
    const message = {
      id: "message-4",
      chatId: "chat-1",
      role: "ASSISTANT",
      content: "Fallback answer",
      citationsJson: "{bad json",
      createdAt: new Date("2026-04-07T08:03:00.000Z"),
    } satisfies Message;

    expect(serializeMessage(message) as any).toEqual({
      id: "message-4",
      chatId: "chat-1",
      role: "assistant",
      content: "Fallback answer",
      createdAt: "2026-04-07T08:03:00.000Z",
    });
  });
});
