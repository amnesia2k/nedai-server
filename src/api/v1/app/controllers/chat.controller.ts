import type { Context } from "hono";

import type { AppBindings } from "@/middleware/auth";
import { getJwtPayload } from "@/middleware/auth";
import ChatService from "@/api/v1/services/chat.service";
import { chatParamsSchema } from "@/api/v1/app/schemas/chat.schema";
import respond from "@/utils/response.util";

export async function listChats(c: Context<AppBindings>) {
  const payload = getJwtPayload(c);
  const chats = await ChatService.listChats(payload.sub);

  return respond(c, 200, "Chats fetched successfully", {
    chats,
  });
}

export async function getChatMessages(c: Context<AppBindings>) {
  const payload = getJwtPayload(c);
  const params = chatParamsSchema.parse(c.req.param());
  const result = await ChatService.getChatMessages(payload.sub, params.chatId);

  return respond(c, 200, "Chat messages fetched successfully", result);
}

export async function sendMessage(c: Context<AppBindings>) {
  const payload = getJwtPayload(c);
  const body = await c.req.json();
  const result = await ChatService.sendMessage(payload.sub, body);

  return respond(c, 201, "Message sent successfully", result);
}
