import { z } from "zod";

export const chatParamsSchema = z
  .object({
    chatId: z.string().uuid("Chat ID must be a valid UUID"),
  })
  .strict();

export const sendMessageSchema = z
  .object({
    chatId: z.string().uuid("Chat ID must be a valid UUID").optional(),
    content: z
      .string()
      .trim()
      .min(1, "Message content is required")
      .max(8000, "Message content must be 8000 characters or fewer"),
  })
  .strict();

export type ChatParams = z.infer<typeof chatParamsSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
