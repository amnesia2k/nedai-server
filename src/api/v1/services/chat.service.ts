import type { Chat, Message, Prisma } from "@prisma/client";
import { MessageRole } from "@prisma/client";
import type Groq from "groq-sdk";

import { ApiError } from "@/lib/api-error";
import prisma from "@/lib/prisma";
import { env } from "@/utils/env";
import { sendMessageSchema } from "@/api/v1/app/schemas/chat.schema";
import { serializeChat } from "@/api/v1/serializers/chat.serializer";
import { serializeMessage } from "@/api/v1/serializers/message.serializer";
import ChatRetrievalService, {
  type RetrievedChunk,
} from "@/api/v1/services/chat-retrieval.service";
import { getGroqClient } from "@/lib/groq";

type PrismaLike = Pick<typeof prisma, "chat" | "message">;

type GroqClientLike = Pick<Groq, "chat">;

type SendMessagePayload = {
  chatId?: string;
  content: string;
  documentIds?: string[];
};

type ChatRetrievalServiceLike = {
  retrieveRelevantChunks: (
    userId: string,
    question: string,
    documentIds?: string[],
  ) => Promise<RetrievedChunk[]>;
};

type AssistantSource = {
  subject: string;
  lessonTitle: string;
  sourcePath: string;
  pageNumber?: number;
};

type AssistantMetadata = {
  grounded: boolean;
  usedGeneralKnowledge: boolean;
  sources: AssistantSource[];
  retrieval: Array<{
    documentId: string;
    chunkId: string;
    score: number;
    excerpt: string;
  }>;
};

type ChatServiceOptions = {
  prisma?: PrismaLike;
  retrievalService?: ChatRetrievalServiceLike;
  getGroqClient?: () => GroqClientLike;
  historyLimit?: number;
  chatModel?: string;
};

const CHAT_TITLE_LIMIT = 60;
const MAX_CONTEXT_CHARS = 1200;
const MAX_RETRIEVAL_EXCERPT_CHARS = 220;

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function truncateText(value: string, limit: number) {
  if (value.length <= limit) {
    return value;
  }

  return `${value.slice(0, limit - 3).trimEnd()}...`;
}

function buildChatTitle(content: string) {
  const normalized = normalizeWhitespace(content);

  if (!normalized) {
    return "New chat";
  }

  return truncateText(normalized, CHAT_TITLE_LIMIT);
}

function trimChunkText(text: string) {
  return truncateText(text, MAX_CONTEXT_CHARS);
}

function trimRetrievalExcerpt(text: string) {
  return truncateText(text, MAX_RETRIEVAL_EXCERPT_CHARS);
}

function extractCompletionContent(completion: any) {
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

function dedupeSources(chunks: RetrievedChunk[]): AssistantSource[] {
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

function buildRetrievalMetadata(chunks: RetrievedChunk[]) {
  return chunks.map((chunk) => ({
    documentId: chunk.documentId,
    chunkId: chunk.chunkId,
    score: Number(chunk.score.toFixed(4)),
    excerpt: trimRetrievalExcerpt(chunk.text),
  }));
}

function buildContextBlock(chunks: RetrievedChunk[]) {
  if (chunks.length === 0) {
    return "No relevant study context was retrieved for this question.";
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

function mapHistoryMessage(message: Message) {
  return {
    role: message.role.toLowerCase() as "system" | "user" | "assistant",
    content: message.content,
  };
}

function toErrorRecord(error: unknown) {
  if (typeof error === "object" && error !== null) {
    return error as Record<string, unknown>;
  }

  return null;
}

function getNestedMessage(value: unknown) {
  const record = toErrorRecord(value);

  if (!record || typeof record.message !== "string") {
    return undefined;
  }

  return record.message;
}

function logChatStageError(
  stage: "retrieval" | "provider",
  error: unknown,
  context: {
    userId: string;
    chatId: string;
    model?: string;
  },
) {
  const errorRecord = toErrorRecord(error);

  console.error(`[chat:${stage}] request failed`, {
    userId: context.userId,
    chatId: context.chatId,
    ...(context.model ? { model: context.model } : {}),
    name: error instanceof Error ? error.name : undefined,
    message:
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : undefined,
    status:
      typeof errorRecord?.status === "number" ? errorRecord.status : undefined,
    code: typeof errorRecord?.code === "string" ? errorRecord.code : undefined,
    cause: getNestedMessage(errorRecord?.cause),
    upstream: toErrorRecord(errorRecord?.error) ?? undefined,
  });
}

export class ChatServiceImpl {
  private readonly prisma: PrismaLike;
  private readonly retrievalService: ChatRetrievalServiceLike;
  private readonly getGroqClient: () => GroqClientLike;
  private readonly historyLimit: number;
  private readonly chatModel: string;

  constructor(options: ChatServiceOptions = {}) {
    this.prisma = options.prisma ?? prisma;
    this.retrievalService = options.retrievalService ?? ChatRetrievalService;
    this.getGroqClient = options.getGroqClient ?? getGroqClient;
    this.historyLimit = options.historyLimit ?? env.CHAT_HISTORY_LIMIT;
    this.chatModel = options.chatModel ?? env.GROQ_CHAT_MODEL;
  }

  public async listChats(userId: string) {
    const chats = await this.prisma.chat.findMany({
      where: {
        userId,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    return chats.map(serializeChat);
  }

  public async getChatMessages(userId: string, chatId: string) {
    const chat = await this.getOwnedChat(userId, chatId);
    const messages = await this.prisma.message.findMany({
      where: {
        chatId: chat.id,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    return {
      chat: serializeChat(chat),
      messages: messages.map(serializeMessage),
    };
  }

  public async sendMessage(userId: string, payload: unknown) {
    const data = sendMessageSchema.parse(payload) as SendMessagePayload;
    let chat = data.chatId
      ? await this.getOwnedChat(userId, data.chatId)
      : await this.prisma.chat.create({
          data: {
            userId,
            title: "New chat",
          },
        });

    const userMessage = await this.prisma.message.create({
      data: {
        chatId: chat.id,
        role: MessageRole.USER,
        content: data.content,
      },
    });

    const nextTitle =
      chat.title === "New chat" ? buildChatTitle(data.content) : chat.title;
    chat = await this.prisma.chat.update({
      where: {
        id: chat.id,
      },
      data: {
        title: nextTitle,
      },
    });

    const history = await this.prisma.message.findMany({
      where: {
        chatId: chat.id,
        NOT: {
          id: userMessage.id,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: this.historyLimit,
    });
    const orderedHistory = history.reverse();
    let retrievedChunks: RetrievedChunk[];

    try {
      retrievedChunks = await this.retrievalService.retrieveRelevantChunks(
        userId,
        data.content,
        data.documentIds,
      );
    } catch (error) {
      logChatStageError("retrieval", error, {
        userId,
        chatId: chat.id,
      });
      throw error;
    }

    const client = this.getGroqClient();
    const promptMessages = [
      {
        role: "system" as const,
        content:
          "You are NedAI, a concise study assistant. Prefer the provided study context when it is relevant. If the context is weak or missing, say so briefly and answer using general knowledge. Do not invent or claim sources you were not given. Keep the answer clear, short, and educational.",
      },
      {
        role: "system" as const,
        content: `Retrieved context:\n\n${buildContextBlock(retrievedChunks)}`,
      },
      ...orderedHistory.map(mapHistoryMessage),
      {
        role: "user" as const,
        content: data.content,
      },
    ];

    let completion: any;

    try {
      completion = await client.chat.completions.create({
        model: this.chatModel,
        stream: false,
        temperature: 0.2,
        max_tokens: 800,
        messages: promptMessages,
      });
    } catch (error) {
      logChatStageError("provider", error, {
        userId,
        chatId: chat.id,
        model: this.chatModel,
      });
      throw new ApiError(502, "AI provider request failed");
    }

    const assistantContent =
      extractCompletionContent(completion) ||
      "I could not generate a response right now.";
    const sources = dedupeSources(retrievedChunks);
    const assistantMetadata: AssistantMetadata = {
      grounded: retrievedChunks.length > 0,
      usedGeneralKnowledge: retrievedChunks.length === 0,
      sources,
      retrieval: buildRetrievalMetadata(retrievedChunks),
    };

    const assistantMessage = await this.prisma.message.create({
      data: {
        chatId: chat.id,
        role: MessageRole.ASSISTANT,
        content: assistantContent,
        citationsJson: assistantMetadata as Prisma.JsonObject,
      },
    });

    chat = await this.prisma.chat.update({
      where: {
        id: chat.id,
      },
      data: {
        title: chat.title,
      },
    });

    return {
      chat: serializeChat(chat),
      userMessage: serializeMessage(userMessage),
      assistantMessage: serializeMessage(assistantMessage),
      answer: {
        answer: assistantContent,
        grounded: assistantMetadata.grounded,
        usedGeneralKnowledge: assistantMetadata.usedGeneralKnowledge,
        sources: assistantMetadata.sources,
      },
    };
  }

  private async getOwnedChat(userId: string, chatId: string) {
    const chat = await this.prisma.chat.findFirst({
      where: {
        id: chatId,
        userId,
      },
    });

    if (!chat) {
      throw new ApiError(404, "Chat not found");
    }

    return chat;
  }
}

const ChatService = new ChatServiceImpl();

export default ChatService;
