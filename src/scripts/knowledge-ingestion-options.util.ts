type ScriptOptions = {
  maxDocuments?: number;
  maxChunks?: number;
  batchSize?: number;
  subject?: string;
  startAfter?: string;
  overwrite?: boolean;
};

function parseOptionalNumber(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseOptionalBoolean(value: string | undefined): boolean | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === "true") {
    return true;
  }

  if (normalized === "false") {
    return false;
  }

  return undefined;
}

export function readKnowledgeIngestionOptionsFromEnv(): ScriptOptions {
  return {
    maxDocuments: parseOptionalNumber(process.env.NEDAI_KNOWLEDGE_MAX_DOCUMENTS),
    maxChunks: parseOptionalNumber(process.env.NEDAI_KNOWLEDGE_MAX_CHUNKS),
    batchSize: parseOptionalNumber(process.env.NEDAI_EMBED_BATCH_SIZE),
    subject: process.env.NEDAI_KNOWLEDGE_SUBJECT?.trim() || undefined,
    startAfter: process.env.NEDAI_KNOWLEDGE_START_AFTER?.trim() || undefined,
    overwrite: parseOptionalBoolean(process.env.NEDAI_KNOWLEDGE_OVERWRITE),
  };
}
