import { DocumentOrigin, DocumentVisibility } from "@prisma/client";

export const LEGACY_KNOWLEDGE_BASE_USER_ID =
  "39914ef7-85ee-4270-a790-ab3112662905";

type DocumentOwnership = {
  userId: string | null;
  visibility: DocumentVisibility;
  origin?: DocumentOrigin;
};

type ChunkOwnership = {
  userId: string | null;
  visibility: DocumentVisibility;
};

export function buildGlobalCorpusDocumentOwnership(): Required<DocumentOwnership> {
  const ownership = {
    userId: null,
    visibility: DocumentVisibility.GLOBAL,
    origin: DocumentOrigin.DEFAULT_CORPUS,
  };

  assertDocumentOwnershipInvariant(ownership);
  return ownership;
}

export function buildGlobalCorpusChunkOwnership(): ChunkOwnership {
  const ownership = {
    userId: null,
    visibility: DocumentVisibility.GLOBAL,
  };

  assertChunkOwnershipInvariant(ownership);
  return ownership;
}

export function assertDocumentOwnershipInvariant(
  ownership: DocumentOwnership,
): void {
  if (
    ownership.visibility === DocumentVisibility.PRIVATE &&
    ownership.userId === null
  ) {
    throw new Error("PRIVATE documents must have a userId.");
  }

  if (
    ownership.visibility === DocumentVisibility.GLOBAL &&
    ownership.userId !== null
  ) {
    throw new Error("GLOBAL documents must not have a userId.");
  }

  if (
    ownership.origin === DocumentOrigin.DEFAULT_CORPUS &&
    (ownership.visibility !== DocumentVisibility.GLOBAL ||
      ownership.userId !== null)
  ) {
    throw new Error("DEFAULT_CORPUS documents must be GLOBAL and ownerless.");
  }
}

export function assertChunkOwnershipInvariant(ownership: ChunkOwnership): void {
  if (
    ownership.visibility === DocumentVisibility.PRIVATE &&
    ownership.userId === null
  ) {
    throw new Error("PRIVATE chunks must have a userId.");
  }

  if (
    ownership.visibility === DocumentVisibility.GLOBAL &&
    ownership.userId !== null
  ) {
    throw new Error("GLOBAL chunks must not have a userId.");
  }
}

export function assertChunkMatchesDocumentOwnership(
  document: DocumentOwnership,
  chunk: ChunkOwnership,
): void {
  assertDocumentOwnershipInvariant(document);
  assertChunkOwnershipInvariant(chunk);

  if (document.visibility !== chunk.visibility) {
    throw new Error("Chunk visibility must match its parent document.");
  }

  if (document.userId !== chunk.userId) {
    throw new Error("Chunk ownership must match its parent document.");
  }
}
