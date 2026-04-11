import type { Chat, Documents, Message, Prisma, TimetableActivity, User } from "@prisma/client";
import { DocumentOrigin, DocumentStatus, DocumentVisibility, MessageRole } from "@prisma/client";
import type Groq from "groq-sdk";

import { ApiError } from "@/lib/api-error";
import prisma from "@/lib/prisma";
import { env } from "@/utils/env";
import { sendMessageSchema } from "@/api/v1/app/schemas/chat.schema";
import { serializeChat } from "@/api/v1/serializers/chat.serializer";
import { serializeMessage } from "@/api/v1/serializers/message.serializer";
import {
  buildContextBlock,
  buildRetrievalMetadata,
  dedupeSources,
  extractCompletionContent,
} from "@/api/v1/services/ai-response.util";
import ChatRetrievalService, {
  type RetrievedChunk,
} from "@/api/v1/services/chat-retrieval.service";
import {
  buildKnowledgeVaultContextBlock,
  buildTimetableContextBlock,
  buildUserContextBlock,
} from "@/api/v1/services/user-context.service";
import { getGroqClient } from "@/lib/groq";
import { isAssessmentRequest } from "@/utils/assessment-intent.util";

type PrismaLike = Pick<
  typeof prisma,
  "chat" | "message" | "user" | "documents" | "timetableActivity"
>;

type GroqClientLike = Pick<Groq, "chat">;

type SendMessagePayload = {
  chatId?: string;
  documentId?: string;
  content: string;
};

type ChatRetrievalServiceLike = {
  retrieveRelevantChunks: (
    userId: string,
    question: string,
    options?: {
      documentId?: string;
    },
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
const QUIZ_ATTACHMENT_REQUIRED_MESSAGE =
  "Tag a document with @ before requesting a quiz or exam, then retry.";

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

type SelectedDocument = Pick<
  Documents,
  "id" | "title" | "sourceType" | "status"
>;

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

  public async clearChats(userId: string) {
    await this.prisma.chat.deleteMany({
      where: {
        userId,
      },
    });
  }

  public async sendMessage(userId: string, payload: unknown) {
    const data = sendMessageSchema.parse(payload) as SendMessagePayload;
    const selectedDocument = data.documentId
      ? await this.getSelectedDocument(userId, data.documentId)
      : null;

    if (isAssessmentRequest(data.content) && !selectedDocument) {
      throw new ApiError(400, QUIZ_ATTACHMENT_REQUIRED_MESSAGE);
    }

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
        selectedDocument ? { documentId: selectedDocument.id } : undefined,
      );
    } catch (error) {
      logChatStageError("retrieval", error, {
        userId,
        chatId: chat.id,
      });
      throw error;
    }

    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      throw new ApiError(401, "Unauthorized");
    }

    const [timetableActivities, readyDocuments] = await Promise.all([
      this.prisma.timetableActivity.findMany({
        where: {
          userId,
        },
        orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
      }),
      this.prisma.documents.findMany({
        where: {
          userId,
          visibility: DocumentVisibility.PRIVATE,
          origin: DocumentOrigin.USER_UPLOAD,
          status: DocumentStatus.READY,
        },
        orderBy: {
          createdAt: "desc",
        },
      }),
    ]);

    const client = this.getGroqClient();
    const promptMessages = [
      {
        role: "system" as const,
        content:
          "You are NedAI, a concise study assistant. Prefer the provided study context when it is relevant. If the context is weak or missing, say so briefly and answer using general knowledge. Do not invent or claim sources you were not given. Keep answers clear, educational, and formatted in Markdown. Use LaTeX delimiters such as $...$ or $$...$$ when formulas are helpful. If the user asks for a quiz or exam, generate it directly in the chat as Markdown text, tell the student to reply in chat with their answers, and never refer to a separate assessment screen or custom controls.",
      },
      {
        role: "system" as const,
        content: buildUserContextBlock(user),
      },
      {
        role: "system" as const,
        content: buildTimetableContextBlock(timetableActivities),
      },
      {
        role: "system" as const,
        content: buildKnowledgeVaultContextBlock(readyDocuments),
      },
      ...(selectedDocument
        ? [
            {
              role: "system" as const,
              content: `Active tagged document: ${selectedDocument.title} (${selectedDocument.sourceType})`,
            },
          ]
        : []),
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

  private async getSelectedDocument(userId: string, documentId: string) {
    const document = await this.prisma.documents.findFirst({
      where: {
        id: documentId,
        userId,
        visibility: DocumentVisibility.PRIVATE,
        origin: DocumentOrigin.USER_UPLOAD,
      },
      select: {
        id: true,
        title: true,
        sourceType: true,
        status: true,
      },
    });

    if (!document) {
      throw new ApiError(404, "Document not found");
    }

    if (document.status !== DocumentStatus.READY) {
      throw new ApiError(
        409,
        "Selected document is not ready yet. Choose another file or wait for processing.",
      );
    }

    return document;
  }
}

const ChatService = new ChatServiceImpl();

export default ChatService;
