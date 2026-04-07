import type { Chat } from "@prisma/client";

export function serializeChat(chat: Chat) {
  return {
    id: chat.id,
    title: chat.title,
    createdAt: chat.createdAt.toISOString(),
    updatedAt: chat.updatedAt.toISOString(),
    lastMessageAt: chat.updatedAt.toISOString(),
  };
}
