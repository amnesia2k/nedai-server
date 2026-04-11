import { beforeEach, describe, expect, it, mock } from "bun:test";
import { UserRole } from "@prisma/client";
import { Hono } from "hono";

import { issueAccessToken } from "@/lib/auth-token";
import { errorHandler } from "@/middleware/error-handler";
import type { AppBindings } from "@/middleware/auth";

const listChatsMock = mock(async () => []);
const clearChatsMock = mock(async () => {});
const getChatMessagesMock = mock(async () => ({
  chat: {
    id: "4ef48063-5a9b-434f-aa5e-3192aaf59a3f",
    title: "Physics",
    createdAt: "2026-04-07T08:00:00.000Z",
    updatedAt: "2026-04-07T08:01:00.000Z",
    lastMessageAt: "2026-04-07T08:01:00.000Z",
  },
  messages: [],
}));
const sendMessageMock = mock(async () => ({
  chat: {
    id: "4ef48063-5a9b-434f-aa5e-3192aaf59a3f",
    title: "Physics",
    createdAt: "2026-04-07T08:00:00.000Z",
    updatedAt: "2026-04-07T08:01:00.000Z",
    lastMessageAt: "2026-04-07T08:01:00.000Z",
  },
  userMessage: {
    id: "message-user",
    chatId: "4ef48063-5a9b-434f-aa5e-3192aaf59a3f",
    role: "user",
    content: "Explain speed",
    createdAt: "2026-04-07T08:00:30.000Z",
  },
  assistantMessage: {
    id: "message-assistant",
    chatId: "4ef48063-5a9b-434f-aa5e-3192aaf59a3f",
    role: "assistant",
    content: "Speed is distance over time.",
    createdAt: "2026-04-07T08:01:00.000Z",
  },
  answer: {
    answer: "Speed is distance over time.",
    grounded: true,
    usedGeneralKnowledge: false,
    sources: [],
  },
}));

mock.module("@/api/v1/services/chat.service", () => ({
  default: {
    listChats: listChatsMock,
    clearChats: clearChatsMock,
    getChatMessages: getChatMessagesMock,
    sendMessage: sendMessageMock,
  },
}));

const { default: chatRoutes } = await import(
  "@/api/v1/app/routes/chat.route"
);

function createApp() {
  const app = new Hono<AppBindings>();
  app.route("/api/v1/chats", chatRoutes);
  app.onError(errorHandler);
  return app;
}

async function createAuthHeader() {
  const token = await issueAccessToken({
    id: "user-1",
    email: "user@example.com",
    role: UserRole.STUDENT,
  });

  return {
    Authorization: `Bearer ${token}`,
  };
}

describe("chat routes", () => {
  beforeEach(() => {
    listChatsMock.mockReset();
    clearChatsMock.mockReset();
    getChatMessagesMock.mockReset();
    sendMessageMock.mockReset();
    (listChatsMock as any).mockResolvedValue([]);
    (clearChatsMock as any).mockResolvedValue(undefined);
    (getChatMessagesMock as any).mockResolvedValue({
      chat: {
        id: "4ef48063-5a9b-434f-aa5e-3192aaf59a3f",
        title: "Physics",
        createdAt: "2026-04-07T08:00:00.000Z",
        updatedAt: "2026-04-07T08:01:00.000Z",
        lastMessageAt: "2026-04-07T08:01:00.000Z",
      },
      messages: [],
    });
    (sendMessageMock as any).mockResolvedValue({
      chat: {
        id: "4ef48063-5a9b-434f-aa5e-3192aaf59a3f",
        title: "Physics",
        createdAt: "2026-04-07T08:00:00.000Z",
        updatedAt: "2026-04-07T08:01:00.000Z",
        lastMessageAt: "2026-04-07T08:01:00.000Z",
      },
      userMessage: {
        id: "message-user",
        chatId: "4ef48063-5a9b-434f-aa5e-3192aaf59a3f",
        role: "user",
        content: "Explain speed",
        createdAt: "2026-04-07T08:00:30.000Z",
      },
      assistantMessage: {
        id: "message-assistant",
        chatId: "4ef48063-5a9b-434f-aa5e-3192aaf59a3f",
        role: "assistant",
        content: "Speed is distance over time.",
        createdAt: "2026-04-07T08:01:00.000Z",
      },
      answer: {
        answer: "Speed is distance over time.",
        grounded: true,
        usedGeneralKnowledge: false,
        sources: [],
      },
    });
  });

  it("requires auth on all endpoints", async () => {
    const app = createApp();
    const response = await app.request("/api/v1/chats");
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.message).toBe("Unauthorized");
  });

  it("lists chats for the authenticated user", async () => {
    const app = createApp();
    const headers = await createAuthHeader();
    (listChatsMock as any).mockResolvedValueOnce([
      {
        id: "chat-1",
        title: "Physics",
        createdAt: "2026-04-07T08:00:00.000Z",
        updatedAt: "2026-04-07T08:01:00.000Z",
        lastMessageAt: "2026-04-07T08:01:00.000Z",
      },
    ]);

    const response = await app.request("/api/v1/chats", { headers });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(listChatsMock).toHaveBeenCalledWith("user-1");
    expect(body.data.chats).toHaveLength(1);
  });

  it("clears chat history", async () => {
    const app = createApp();
    const headers = await createAuthHeader();

    const response = await app.request("/api/v1/chats", {
      method: "DELETE",
      headers,
    });

    expect(response.status).toBe(204);
    expect(clearChatsMock).toHaveBeenCalledWith("user-1");
  });

  it("gets chat messages for an owned chat", async () => {
    const app = createApp();
    const headers = await createAuthHeader();

    const response = await app.request(
      "/api/v1/chats/4ef48063-5a9b-434f-aa5e-3192aaf59a3f/messages",
      {
        headers,
      },
    );

    expect(response.status).toBe(200);
    expect(getChatMessagesMock).toHaveBeenCalledWith(
      "user-1",
      "4ef48063-5a9b-434f-aa5e-3192aaf59a3f",
    );
  });

  it("sends a new chat message", async () => {
    const app = createApp();
    const headers = await createAuthHeader();

    const response = await app.request("/api/v1/chats/messages", {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: "Explain speed",
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(sendMessageMock).toHaveBeenCalledWith("user-1", {
      content: "Explain speed",
    });
    expect(body.data.answer.answer).toBe("Speed is distance over time.");
  });
});
