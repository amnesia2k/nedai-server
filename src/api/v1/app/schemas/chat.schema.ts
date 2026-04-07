import { z } from "zod";

function dedupeDocumentIds(documentIds: string[] | undefined) {
  if (!documentIds) {
    return undefined;
  }

  return Array.from(new Set(documentIds));
}

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
    documentIds: z
      .array(z.string().uuid("Document ID must be a valid UUID"))
      .max(20, "You can only target up to 20 documents")
      .optional(),
  })
  .strict()
  .transform((value) => ({
    ...value,
    ...(value.documentIds
      ? { documentIds: dedupeDocumentIds(value.documentIds) }
      : {}),
  }));

export type ChatParams = z.infer<typeof chatParamsSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
