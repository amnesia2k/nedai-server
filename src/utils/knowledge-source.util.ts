import path from "node:path";

const MIME_TYPES = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
} as const;

export const KNOWLEDGE_CHUNK_SIZE = 1800;
export const KNOWLEDGE_CHUNK_OVERLAP = 200;

export type KnowledgeSourceType = "DOCX" | "PDF";

export type KnowledgeSourceMetadata = {
  relativePath: string;
  subject: string | null;
  title: string;
  originalFilename: string;
  mimeType: string;
  sourceType: KnowledgeSourceType;
};

export function sanitizeExtractedText(text: string): string {
  return text
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function chunkText(text: string, chunkSize = KNOWLEDGE_CHUNK_SIZE, chunkOverlap = KNOWLEDGE_CHUNK_OVERLAP): string[] {
  const normalized = sanitizeExtractedText(text);

  if (!normalized) {
    return [];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < normalized.length) {
    const end = Math.min(start + chunkSize, normalized.length);
    const chunk = normalized.slice(start, end).trim();

    if (chunk) {
      chunks.push(chunk);
    }

    if (end >= normalized.length) {
      break;
    }

    start = Math.max(end - chunkOverlap, start + 1);
  }

  return chunks;
}

export function estimateTokenCount(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

export function getKnowledgeSourceMetadata(rootPath: string, filePath: string): KnowledgeSourceMetadata {
  const relativePath = path.relative(rootPath, filePath).split(path.sep).join("/");
  const originalFilename = path.basename(filePath);
  const extension = path.extname(filePath).toLowerCase();
  const sourceType = extension === ".pdf" ? "PDF" : "DOCX";
  const mimeType = extension === ".pdf" ? MIME_TYPES.pdf : MIME_TYPES.docx;
  const title = originalFilename.replace(/\.[^.]+$/, "");
  const [subject] = relativePath.split("/");

  return {
    relativePath,
    subject: subject || null,
    title,
    originalFilename,
    mimeType,
    sourceType,
  };
}

export function toVectorLiteral(values: number[]): string {
  return `[${values.map((value) => Number(value).toString()).join(",")}]`;
}
