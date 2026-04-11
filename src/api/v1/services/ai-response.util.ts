import type { RetrievedChunk } from "@/api/v1/services/chat-retrieval.service";

export type AssistantSource = {
  subject: string;
  lessonTitle: string;
  sourcePath: string;
  pageNumber?: number;
};

const MAX_CONTEXT_CHARS = 1200;
const MAX_RETRIEVAL_EXCERPT_CHARS = 220;

function truncateText(value: string, limit: number) {
  if (value.length <= limit) {
    return value;
  }

  return `${value.slice(0, limit - 3).trimEnd()}...`;
}

function trimChunkText(text: string) {
  return truncateText(text, MAX_CONTEXT_CHARS);
}

function trimRetrievalExcerpt(text: string) {
  return truncateText(text, MAX_RETRIEVAL_EXCERPT_CHARS);
}

export function extractCompletionContent(completion: any) {
  const rawContent = completion.choices[0]?.message?.content;

  if (typeof rawContent === "string") {
    return rawContent.trim();
  }

  if (Array.isArray(rawContent)) {
    return rawContent
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }

        if (
          typeof part === "object" &&
          part !== null &&
          "text" in part &&
          typeof part.text === "string"
        ) {
          return part.text;
        }

        return "";
      })
      .join("")
      .trim();
  }

  return "";
}

export function dedupeSources(chunks: RetrievedChunk[]): AssistantSource[] {
  const seen = new Set<string>();
  const sources: AssistantSource[] = [];

  for (const chunk of chunks) {
    const source = {
      subject: chunk.subject,
      lessonTitle: chunk.lessonTitle,
      sourcePath: chunk.sourcePath,
      ...(chunk.pageNumber !== undefined
        ? { pageNumber: chunk.pageNumber }
        : {}),
    };
    const key = JSON.stringify(source);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    sources.push(source);
  }

  return sources;
}

export function buildRetrievalMetadata(chunks: RetrievedChunk[]) {
  return chunks.map((chunk) => ({
    documentId: chunk.documentId,
    chunkId: chunk.chunkId,
    score: Number(chunk.score.toFixed(4)),
    excerpt: trimRetrievalExcerpt(chunk.text),
  }));
}

export function buildContextBlock(chunks: RetrievedChunk[]) {
  if (chunks.length === 0) {
    return "No relevant study context was retrieved for this request.";
  }

  return chunks
    .map((chunk, index) => {
      const lines = [
        `Source ${index + 1}`,
        `Subject: ${chunk.subject}`,
        `Lesson: ${chunk.lessonTitle}`,
        `Path: ${chunk.sourcePath}`,
      ];

      if (chunk.pageNumber !== undefined) {
        lines.push(`Page: ${chunk.pageNumber}`);
      }

      lines.push(`Similarity: ${chunk.score.toFixed(3)}`);
      lines.push(`Content: ${trimChunkText(chunk.text)}`);

      return lines.join("\n");
    })
    .join("\n\n");
}

export function extractJsonObject(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error("The AI response was empty");
  }

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch?.[1]?.trim() ?? trimmed;
  const firstBrace = candidate.indexOf("{");
  const lastBrace = candidate.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("The AI response did not contain a valid JSON object");
  }

  return JSON.parse(candidate.slice(firstBrace, lastBrace + 1));
}
