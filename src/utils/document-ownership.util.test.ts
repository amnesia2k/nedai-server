import { describe, expect, it } from "bun:test";
import { DocumentOrigin, DocumentVisibility } from "@prisma/client";

import {
  assertChunkMatchesDocumentOwnership,
  assertChunkOwnershipInvariant,
  assertDocumentOwnershipInvariant,
  buildGlobalCorpusChunkOwnership,
  buildGlobalCorpusDocumentOwnership,
} from "@/utils/document-ownership.util";

describe("document ownership utils", () => {
  it("builds valid ownerless global corpus ownership records", () => {
    expect(buildGlobalCorpusDocumentOwnership()).toEqual({
      userId: null,
      visibility: DocumentVisibility.GLOBAL,
      origin: DocumentOrigin.DEFAULT_CORPUS,
    });

    expect(buildGlobalCorpusChunkOwnership()).toEqual({
      userId: null,
      visibility: DocumentVisibility.GLOBAL,
    });
  });

  it("rejects private documents without owners", () => {
    expect(() =>
      assertDocumentOwnershipInvariant({
        userId: null,
        visibility: DocumentVisibility.PRIVATE,
      }),
    ).toThrow("PRIVATE documents must have a userId.");
  });

  it("rejects ownerful global chunks", () => {
    expect(() =>
      assertChunkOwnershipInvariant({
        userId: "user-1",
        visibility: DocumentVisibility.GLOBAL,
      }),
    ).toThrow("GLOBAL chunks must not have a userId.");
  });

  it("rejects chunk ownership mismatches against the parent document", () => {
    expect(() =>
      assertChunkMatchesDocumentOwnership(
        {
          userId: null,
          visibility: DocumentVisibility.GLOBAL,
          origin: DocumentOrigin.DEFAULT_CORPUS,
        },
        {
          userId: "user-1",
          visibility: DocumentVisibility.PRIVATE,
        },
      ),
    ).toThrow();
  });
});
