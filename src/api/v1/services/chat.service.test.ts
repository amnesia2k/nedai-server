import { describe, expect, it, mock } from "bun:test";
import { MessageRole, UserRole } from "@prisma/client";

import { ChatServiceImpl } from "@/api/v1/services/chat.service";

const SELECTED_DOCUMENT_ID = "6bb74a48-2f8a-4d9c-abbb-01fced8f3a11";

function createChat(id = "chat-1", title = "New chat") {
  return {
    id,
    userId: "user-1",
    title,
    createdAt: new Date("2026-04-07T08:00:00.000Z"),
    updatedAt: new Date("2026-04-07T08:00:00.000Z"),
  };
}

function createMessage(input: {
  id: string;
  chatId?: string;
  role: MessageRole;
  content: string;
  citationsJson?: unknown;
  createdAt?: Date;
}) {
  return {
    id: input.id,
    chatId: input.chatId ?? "chat-1",
    role: input.role,
    content: input.content,
    citationsJson: input.citationsJson ?? null,
    createdAt: input.createdAt ?? new Date("2026-04-07T08:00:00.000Z"),
  };
}

function createUser() {
  return {
    id: "user-1",
    email: "user@example.com",
    passwordHash: "hashed",
    fullName: "John Doe",
    preferredName: null,
    aboutMe: null,
    likes: [],
    dislikes: [],
    learningPreferences: null,
    role: UserRole.STUDENT,
    institution: "NedAI University",
    department: null,
    matricNumber: "MAT-001",
    staffId: null,
    studentAcademicLevel: "400 Level",
    dateOfBirth: new Date("2000-10-12T00:00:00.000Z"),
    lecturerHighestQualification: null,
    lecturerCurrentAcademicStage: null,
    createdAt: new Date("2026-04-07T08:00:00.000Z"),
    updatedAt: new Date("2026-04-07T08:00:00.000Z"),
  };
}

function createPrismaMock() {
  return {
    user: {
      findUnique: mock(async () => createUser()),
    },
    chat: {
      findMany: mock(async () => []),
      findFirst: mock(async () => null),
      create: mock(async () => createChat()),
      update: mock(async () => createChat()),
      deleteMany: mock(async () => ({ count: 1 })),
    },
    message: {
      findMany: mock(async () => []),
      create: mock(async () =>
        createMessage({
          id: "message-1",
          role: MessageRole.USER,
          content: "Explain speed",
        }),
      ),
    },
    timetableActivity: {
      findMany: mock(async () => [
        {
          id: "activity-1",
          userId: "user-1",
          name: "Study group",
          dayOfWeek: "MONDAY",
          startTime: "09:00",
          endTime: "11:00",
          createdAt: new Date("2026-04-07T08:00:00.000Z"),
          updatedAt: new Date("2026-04-07T08:00:00.000Z"),
        },
      ]),
    },
    documents: {
      findFirst: mock(async () => null),
      findMany: mock(async () => [
        {
          id: "doc-1",
          userId: "user-1",
          title: "Chemistry Notes",
          originalFilename: "chemistry.pdf",
          mimeType: "application/pdf",
          storagePath: "uploads/user-1/chemistry.pdf",
          status: "READY",
          visibility: "PRIVATE",
          origin: "USER_UPLOAD",
          sourceType: "PDF",
          byteSize: 100,
          chunkCount: 2,
          processingError: null,
          subject: null,
          contentHash: null,
          createdAt: new Date("2026-04-07T08:00:00.000Z"),
          updatedAt: new Date("2026-04-07T08:00:00.000Z"),
        },
      ]),
    },
  };
}

describe("ChatServiceImpl", () => {
  it("creates a new chat and stores grounded metadata", async () => {
    const prisma = createPrismaMock();
    const createdChat = createChat("chat-1", "New chat");
    const titledChat = {
      ...createdChat,
      title: "Explain kinetic energy in simple terms",
      updatedAt: new Date("2026-04-07T08:01:00.000Z"),
    };
    const finalChat = {
      ...titledChat,
      updatedAt: new Date("2026-04-07T08:02:00.000Z"),
    };
    const userMessage = createMessage({
      id: "message-user",
      role: MessageRole.USER,
      content: "Explain kinetic energy in simple terms",
      createdAt: new Date("2026-04-07T08:00:30.000Z"),
    });
    const assistantMessage = createMessage({
      id: "message-assistant",
      role: MessageRole.ASSISTANT,
      content: "Kinetic energy is the energy of motion.",
      citationsJson: {
        grounded: true,
        usedGeneralKnowledge: false,
        sources: [],
        retrieval: [],
      },
      createdAt: new Date("2026-04-07T08:01:30.000Z"),
    });
    const retrievalService = {
      retrieveRelevantChunks: mock(async () => [
        {
          chunkId: "chunk-1",
          documentId: "doc-1",
          subject: "Physics",
          lessonTitle: "Energy",
          sourcePath: "Physics/Energy.docx",
          pageNumber: 3,
          text: "Kinetic energy is energy possessed by a moving body.",
          score: 0.91,
        },
      ]),
    };
    const createCompletion = mock(async () => ({
      choices: [
        {
          message: {
            content: "Kinetic energy is the energy of motion.",
          },
        },
      ],
    }));

    (prisma.chat.create as any).mockResolvedValue(createdChat);
    (prisma.chat.update as any).mockResolvedValueOnce(titledChat);
    (prisma.chat.update as any).mockResolvedValueOnce(finalChat);
    (prisma.message.create as any).mockResolvedValueOnce(userMessage);
    (prisma.message.create as any).mockResolvedValueOnce(assistantMessage);
    (prisma.message.findMany as any).mockResolvedValueOnce([]);

    const service = new ChatServiceImpl({
      prisma: prisma as never,
      retrievalService,
      getGroqClient: () =>
        ({
          chat: {
            completions: {
              create: createCompletion,
            },
          },
        }) as never,
      historyLimit: 10,
      chatModel: "openai/gpt-oss-20b",
    });

    const result = await service.sendMessage("user-1", {
      content: "Explain kinetic energy in simple terms",
    });

    expect(retrievalService.retrieveRelevantChunks).toHaveBeenCalledWith(
      "user-1",
      "Explain kinetic energy in simple terms",
      { documentIds: [] },
    );
    expect(createCompletion).toHaveBeenCalledTimes(1);
    const promptMessages = (createCompletion as any).mock.calls[0][0].messages;
    expect(promptMessages[1].content).toContain("Academic profile");
    expect(promptMessages[2].content).toContain("Weekly timetable");
    expect(promptMessages[3].content).toContain("Knowledge vault");
    expect(result.answer.grounded).toBe(true);
  });

  it("rejects access to another user's chat", async () => {
    const prisma = createPrismaMock() as any;
    const service = new ChatServiceImpl({
      prisma,
      retrievalService: {
        retrieveRelevantChunks: mock(async () => []),
      },
      getGroqClient: () =>
        ({
          chat: {
            completions: {
              create: mock(async () => ({
                choices: [{ message: { content: "unused" } }],
              })),
            },
          },
        }) as never,
    });

    await expect(
      service.sendMessage("user-1", {
        chatId: "05c07d3d-c14b-4a55-a17d-a1afeb67e3ec",
        content: "Explain motion",
      }),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: "Chat not found",
    });
  });

  it("falls back to general knowledge when retrieval is empty", async () => {
    const prisma = createPrismaMock();
    const existingChat = createChat("chat-1", "Physics review");
    const finalChat = {
      ...existingChat,
      updatedAt: new Date("2026-04-07T08:05:00.000Z"),
    };
    const userMessage = createMessage({
      id: "message-user",
      role: MessageRole.USER,
      content: "Explain inertia",
    });
    const assistantMessage = createMessage({
      id: "message-assistant",
      role: MessageRole.ASSISTANT,
      content: "I am answering from general knowledge.",
      citationsJson: {
        grounded: false,
        usedGeneralKnowledge: true,
        sources: [],
        retrieval: [],
      },
    });

    (prisma.chat.findFirst as any).mockResolvedValue(existingChat);
    (prisma.chat.update as any).mockResolvedValueOnce(existingChat);
    (prisma.chat.update as any).mockResolvedValueOnce(finalChat);
    (prisma.message.create as any).mockResolvedValueOnce(userMessage);
    (prisma.message.create as any).mockResolvedValueOnce(assistantMessage);
    (prisma.message.findMany as any).mockResolvedValueOnce([]);

    const service = new ChatServiceImpl({
      prisma: prisma as never,
      retrievalService: {
        retrieveRelevantChunks: mock(async () => []),
      },
      getGroqClient: () =>
        ({
          chat: {
            completions: {
              create: mock(async () => ({
                choices: [
                  {
                    message: {
                      content: "I am answering from general knowledge.",
                    },
                  },
                ],
              })),
            },
          },
        }) as never,
    });

    const result = await service.sendMessage("user-1", {
      chatId: "e6fd0c85-7fd0-4d04-b252-abf6ff5da87c",
      content: "Explain inertia",
    });

    expect(result.answer.usedGeneralKnowledge).toBe(true);
    expect(result.answer.grounded).toBe(false);
  });

  it("rejects assessment prompts without a tagged document", async () => {
    const prisma = createPrismaMock();
    const service = new ChatServiceImpl({
      prisma: prisma as never,
      retrievalService: {
        retrieveRelevantChunks: mock(async () => []),
      },
      getGroqClient: () =>
        ({
          chat: {
            completions: {
              create: mock(async () => ({
                choices: [{ message: { content: "unused" } }],
              })),
            },
          },
        }) as never,
    });

    await expect(
      service.sendMessage("user-1", {
        content: "Give me a 5-question multiple-choice quiz",
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message:
        "Tag a document with @ before requesting a quiz or exam, then retry.",
    });
  });

  it("uses the selected document for retrieval and prompt context", async () => {
    const prisma = createPrismaMock();
    const createdChat = createChat("chat-1", "New chat");
    const titledChat = {
      ...createdChat,
      title: "Give me a chemistry quiz",
      updatedAt: new Date("2026-04-07T08:01:00.000Z"),
    };
    const finalChat = {
      ...titledChat,
      updatedAt: new Date("2026-04-07T08:02:00.000Z"),
    };
    const userMessage = createMessage({
      id: "message-user",
      role: MessageRole.USER,
      content: "Give me a chemistry quiz",
      createdAt: new Date("2026-04-07T08:00:30.000Z"),
    });
    const assistantMessage = createMessage({
      id: "message-assistant",
      role: MessageRole.ASSISTANT,
      content: "1. Question one",
      citationsJson: {
        grounded: true,
        usedGeneralKnowledge: false,
        sources: [],
        retrieval: [],
      },
      createdAt: new Date("2026-04-07T08:01:30.000Z"),
    });
    const retrievalService = {
      retrieveRelevantChunks: mock(async () => [
        {
          chunkId: "chunk-1",
          documentId: "doc-1",
          subject: "Chemistry",
          lessonTitle: "Atomic structure",
          sourcePath: "uploads/user-1/chemistry.pdf",
          pageNumber: 3,
          text: "Atoms consist of protons, neutrons, and electrons.",
          score: 0.91,
        },
      ]),
    };
    const createCompletion = mock(async () => ({
      choices: [
        {
          message: {
            content: "1. Question one",
          },
        },
      ],
    }));

    (prisma.chat.create as any).mockResolvedValue(createdChat);
    (prisma.chat.update as any).mockResolvedValueOnce(titledChat);
    (prisma.chat.update as any).mockResolvedValueOnce(finalChat);
    (prisma.message.create as any).mockResolvedValueOnce(userMessage);
    (prisma.message.create as any).mockResolvedValueOnce(assistantMessage);
    (prisma.message.findMany as any).mockResolvedValueOnce([]);
    (prisma.documents.findFirst as any).mockResolvedValueOnce({
      id: SELECTED_DOCUMENT_ID,
      title: "Chemistry Notes",
      sourceType: "PDF",
      status: "READY",
    });

    const service = new ChatServiceImpl({
      prisma: prisma as never,
      retrievalService,
      getGroqClient: () =>
        ({
          chat: {
            completions: {
              create: createCompletion,
            },
          },
        }) as never,
      historyLimit: 10,
      chatModel: "openai/gpt-oss-20b",
    });

    await service.sendMessage("user-1", {
      content: "Give me a chemistry quiz",
      documentId: SELECTED_DOCUMENT_ID,
    });

    expect(retrievalService.retrieveRelevantChunks).toHaveBeenCalledWith(
      "user-1",
      "Give me a chemistry quiz",
      { documentId: SELECTED_DOCUMENT_ID, topK: 15 },
    );
    expect(prisma.message.create).toHaveBeenCalledWith(
      expect.objectContaining({
        include: {
          document: {
            select: { id: true, title: true, sourceType: true },
          },
        },
      }),
    );

    const promptMessages = (createCompletion as any).mock.calls[0][0].messages;
    expect(
      promptMessages.some(
        (message: { content: string }) =>
          message.content === "Active tagged document: Chemistry Notes (PDF)",
      ),
    ).toBe(true);
    expect(promptMessages[0].content).toContain(
      "generate it directly in the chat as Markdown text",
    );
  });

  it("rejects unknown selected documents", async () => {
    const prisma = createPrismaMock();
    (prisma.documents.findFirst as any).mockResolvedValueOnce(null);
    const service = new ChatServiceImpl({
      prisma: prisma as never,
      retrievalService: {
        retrieveRelevantChunks: mock(async () => []),
      },
      getGroqClient: () =>
        ({
          chat: {
            completions: {
              create: mock(async () => ({
                choices: [{ message: { content: "unused" } }],
              })),
            },
          },
        }) as never,
    });

    await expect(
      service.sendMessage("user-1", {
        content: "Summarize this document",
        documentId: SELECTED_DOCUMENT_ID,
      }),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: "Document not found",
    });
  });

  it("rejects selected documents that are not ready", async () => {
    const prisma = createPrismaMock();
    (prisma.documents.findFirst as any).mockResolvedValueOnce({
      id: SELECTED_DOCUMENT_ID,
      title: "Chemistry Notes",
      sourceType: "PDF",
      status: "PROCESSING",
    });
    const service = new ChatServiceImpl({
      prisma: prisma as never,
      retrievalService: {
        retrieveRelevantChunks: mock(async () => []),
      },
      getGroqClient: () =>
        ({
          chat: {
            completions: {
              create: mock(async () => ({
                choices: [{ message: { content: "unused" } }],
              })),
            },
          },
        }) as never,
    });

    await expect(
      service.sendMessage("user-1", {
        content: "Summarize this document",
        documentId: SELECTED_DOCUMENT_ID,
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      message:
        "Selected document is not ready yet. Choose another file or wait for processing.",
    });
  });

  it("clears all chats for a user", async () => {
    const prisma = createPrismaMock();
    const service = new ChatServiceImpl({
      prisma: prisma as never,
    });

    await service.clearChats("user-1");

    expect(prisma.chat.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
      },
    });
  });
});
