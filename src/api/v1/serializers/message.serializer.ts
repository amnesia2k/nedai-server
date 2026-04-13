import type { Message, MessageRole, Prisma } from "@prisma/client";

export type SerializedMessageSource = {
  subject: string;
  lessonTitle: string;
  sourcePath: string;
  pageNumber?: number;
};

type AssistantMessageMetadata = {
  grounded?: boolean;
  usedGeneralKnowledge?: boolean;
  sources?: SerializedMessageSource[];
};

function normalizeRole(role: MessageRole) {
  return role.toLowerCase() as "user" | "assistant" | "system";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseMetadata(
  citationsJson: Prisma.JsonValue | null,
): AssistantMessageMetadata | null {
  if (!citationsJson) {
    return null;
  }

  let rawValue = citationsJson as unknown;

  if (typeof rawValue === "string") {
    try {
      rawValue = JSON.parse(rawValue);
    } catch {
      return null;
    }
  }

  if (!isRecord(rawValue)) {
    return null;
  }

  const rawSources = Array.isArray(rawValue.sources) ? rawValue.sources : [];
  const sources = rawSources
    .filter(isRecord)
    .map((source) => ({
      subject:
        typeof source.subject === "string" ? source.subject : "Unknown subject",
      lessonTitle:
        typeof source.lessonTitle === "string"
          ? source.lessonTitle
          : "Unknown lesson",
      sourcePath:
        typeof source.sourcePath === "string" ? source.sourcePath : "Unknown",
      pageNumber:
        typeof source.pageNumber === "number" ? source.pageNumber : undefined,
    }));

  return {
    grounded:
      typeof rawValue.grounded === "boolean" ? rawValue.grounded : undefined,
    usedGeneralKnowledge:
      typeof rawValue.usedGeneralKnowledge === "boolean"
        ? rawValue.usedGeneralKnowledge
        : undefined,
    sources,
  };
}

export function serializeMessage(
  message: Message & {
    document?: { id: string; title: string; sourceType: string } | null;
  },
) {
  const serialized = {
    id: message.id,
    chatId: message.chatId,
    role: normalizeRole(message.role),
    content: message.content,
    documentId: message.documentId,
    document: message.document ?? undefined,
    createdAt: message.createdAt.toISOString(),
  };

  if (message.role !== "ASSISTANT") {
    return serialized;
  }

  const metadata = parseMetadata(message.citationsJson);

  return {
    ...serialized,
    ...(metadata?.grounded !== undefined
      ? { grounded: metadata.grounded }
      : {}),
    ...(metadata?.usedGeneralKnowledge !== undefined
      ? { usedGeneralKnowledge: metadata.usedGeneralKnowledge }
      : {}),
    ...(metadata?.sources?.length ? { sources: metadata.sources } : {}),
  };
}
