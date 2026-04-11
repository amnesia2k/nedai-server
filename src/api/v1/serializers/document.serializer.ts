import type { Documents } from "@prisma/client";

type SerializableDocument = Pick<
  Documents,
  | "id"
  | "title"
  | "originalFilename"
  | "sourceType"
  | "status"
  | "byteSize"
  | "chunkCount"
  | "processingError"
  | "createdAt"
  | "updatedAt"
>;

export function serializeDocument(document: SerializableDocument) {
  return {
    id: document.id,
    title: document.title,
    originalFilename: document.originalFilename,
    sourceType: document.sourceType,
    status: document.status,
    byteSize: document.byteSize,
    chunkCount: document.chunkCount,
    processingError: document.processingError,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
  };
}
