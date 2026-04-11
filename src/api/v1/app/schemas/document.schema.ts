import { z } from "zod";

export const documentParamsSchema = z
  .object({
    documentId: z.string().uuid("Document ID must be a valid UUID"),
  })
  .strict();

export const listDocumentsQuerySchema = z
  .object({
    documentName: z
      .string()
      .trim()
      .min(1, "Document name must not be empty")
      .max(255, "Document name must be 255 characters or fewer")
      .optional(),
  })
  .strict();

export type DocumentParams = z.infer<typeof documentParamsSchema>;
export type ListDocumentsQuery = z.infer<typeof listDocumentsQuerySchema>;
