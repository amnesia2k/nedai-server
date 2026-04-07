export function buildPrivateAndGlobalChunkAccessClause(
  userIdPlaceholder = "$1",
  chunkAlias = "dc",
): string {
  return `(
    (${chunkAlias}."visibility" = 'PRIVATE' AND ${chunkAlias}."userId" = ${userIdPlaceholder})
    OR
    (${chunkAlias}."visibility" = 'GLOBAL' AND ${chunkAlias}."userId" IS NULL)
  )`;
}
