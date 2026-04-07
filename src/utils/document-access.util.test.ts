import { describe, expect, it } from "bun:test";

import { buildPrivateAndGlobalChunkAccessClause } from "@/utils/document-access.util";

describe("document access utils", () => {
  it("builds the mixed private and global retrieval clause", () => {
    expect(buildPrivateAndGlobalChunkAccessClause()).toBe(`(
    (dc."visibility" = 'PRIVATE' AND dc."userId" = $1)
    OR
    (dc."visibility" = 'GLOBAL' AND dc."userId" IS NULL)
  )`);
  });

  it("supports custom placeholders and aliases", () => {
    expect(buildPrivateAndGlobalChunkAccessClause("$7", "chunks")).toBe(`(
    (chunks."visibility" = 'PRIVATE' AND chunks."userId" = $7)
    OR
    (chunks."visibility" = 'GLOBAL' AND chunks."userId" IS NULL)
  )`);
  });
});
