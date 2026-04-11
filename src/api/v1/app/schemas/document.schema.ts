import { z } from "zod";

export const documentParamsSchema = z
  .object({
    documentId: z.string().uuid("Document ID must be a valid UUID"),
  })
  .strict();

export type DocumentParams = z.infer<typeof documentParamsSchema>;
