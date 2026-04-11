import { beforeEach, describe, expect, it, mock } from "bun:test";
import {
  DocumentOrigin,
  DocumentStatus,
  DocumentVisibility,
  SourceType,
} from "@prisma/client";

const prismaMock = {
  documents: {
    findMany: mock(async () => []),
    findFirst: mock(async () => null),
    count: mock(async () => 0),
    aggregate: mock(async () => ({
      _sum: {
        byteSize: 0,
      },
    })),
    create: mock(async () => ({
      id: "doc-1",
      userId: "user-1",
      visibility: DocumentVisibility.PRIVATE,
      origin: DocumentOrigin.USER_UPLOAD,
      title: "Chemistry Notes",
      originalFilename: "chemistry.pdf",
      mimeType: "application/pdf",
      storagePath: "https://app_123.ufs.sh/f/file_abc123",
      status: DocumentStatus.UPLOADED,
      sourceType: SourceType.PDF,
      byteSize: 1024,
      contentHash: "hash-1",
      chunkCount: 0,
      processingError: null,
      subject: null,
      createdAt: new Date("2026-04-11T10:00:00.000Z"),
      updatedAt: new Date("2026-04-11T10:00:00.000Z"),
    })),
    delete: mock(async () => undefined),
    update: mock(async () => ({
      id: "doc-1",
      userId: "user-1",
      visibility: DocumentVisibility.PRIVATE,
      origin: DocumentOrigin.USER_UPLOAD,
      title: "Chemistry Notes",
      originalFilename: "chemistry.pdf",
      mimeType: "application/pdf",
      storagePath: "https://app_123.ufs.sh/f/file_abc123",
      status: DocumentStatus.UPLOADED,
      sourceType: SourceType.PDF,
      byteSize: 1024,
      contentHash: "hash-1",
      chunkCount: 0,
      processingError: null,
      subject: null,
      createdAt: new Date("2026-04-11T10:00:00.000Z"),
      updatedAt: new Date("2026-04-11T10:00:00.000Z"),
    })),
  },
  documentChunk: {
    deleteMany: mock(async () => ({ count: 0 })),
  },
};

const assertUploadSupportedMock = mock(async () => {});
const getSourceTypeMock = mock(() => SourceType.PDF);
const deleteStoredFileMock = mock(async () => {});
const deleteUploadThingFileByUrlMock = mock(async () => {});
const queueMock = mock(() => {});

mock.module("@/lib/prisma", () => ({
  default: prismaMock,
}));

mock.module("@/api/v1/services/document-parser.service", () => ({
  default: {
    assertUploadSupported: assertUploadSupportedMock,
    getSourceType: getSourceTypeMock,
  },
}));

mock.module("@/api/v1/services/document-storage.service", () => ({
  default: {
    deleteStoredFile: deleteStoredFileMock,
  },
}));

mock.module("@/uploadthing/utapi", () => ({
  deleteUploadThingFileByUrl: deleteUploadThingFileByUrlMock,
}));

mock.module("@/api/v1/services/user-document-ingestion.service", () => ({
  default: {
    queue: queueMock,
  },
}));

const { DocumentServiceImpl } = await import("@/api/v1/services/document.service");

describe("DocumentServiceImpl", () => {
  beforeEach(() => {
    prismaMock.documents.findMany.mockReset();
    prismaMock.documents.findFirst.mockReset();
    prismaMock.documents.count.mockReset();
    prismaMock.documents.aggregate.mockReset();
    prismaMock.documents.create.mockReset();
    prismaMock.documents.delete.mockReset();
    prismaMock.documents.update.mockReset();
    prismaMock.documentChunk.deleteMany.mockReset();
    assertUploadSupportedMock.mockReset();
    getSourceTypeMock.mockReset();
    deleteStoredFileMock.mockReset();
    deleteUploadThingFileByUrlMock.mockReset();
    queueMock.mockReset();

    (prismaMock.documents.findMany as any).mockResolvedValue([]);
    (prismaMock.documents.findFirst as any).mockResolvedValue(null);
    (prismaMock.documents.count as any).mockResolvedValue(0);
    (prismaMock.documents.aggregate as any).mockResolvedValue({
      _sum: {
        byteSize: 0,
      },
    });
    (prismaMock.documents.create as any).mockResolvedValue({
      id: "doc-1",
      userId: "user-1",
      visibility: DocumentVisibility.PRIVATE,
      origin: DocumentOrigin.USER_UPLOAD,
      title: "Chemistry Notes",
      originalFilename: "chemistry.pdf",
      mimeType: "application/pdf",
      storagePath: "https://app_123.ufs.sh/f/file_abc123",
      status: DocumentStatus.UPLOADED,
      sourceType: SourceType.PDF,
      byteSize: 1024,
      contentHash: "hash-1",
      chunkCount: 0,
      processingError: null,
      subject: null,
      createdAt: new Date("2026-04-11T10:00:00.000Z"),
      updatedAt: new Date("2026-04-11T10:00:00.000Z"),
    });
    (prismaMock.documents.delete as any).mockResolvedValue(undefined);
    (prismaMock.documents.update as any).mockResolvedValue({
      id: "doc-1",
      userId: "user-1",
      visibility: DocumentVisibility.PRIVATE,
      origin: DocumentOrigin.USER_UPLOAD,
      title: "Chemistry Notes",
      originalFilename: "chemistry.pdf",
      mimeType: "application/pdf",
      storagePath: "https://app_123.ufs.sh/f/file_abc123",
      status: DocumentStatus.UPLOADED,
      sourceType: SourceType.PDF,
      byteSize: 1024,
      contentHash: "hash-1",
      chunkCount: 0,
      processingError: null,
      subject: null,
      createdAt: new Date("2026-04-11T10:00:00.000Z"),
      updatedAt: new Date("2026-04-11T10:00:00.000Z"),
    });
    (prismaMock.documentChunk.deleteMany as any).mockResolvedValue({ count: 0 });
    (assertUploadSupportedMock as any).mockResolvedValue(undefined);
    (getSourceTypeMock as any).mockReturnValue(SourceType.PDF);
    (deleteStoredFileMock as any).mockResolvedValue(undefined);
    (deleteUploadThingFileByUrlMock as any).mockResolvedValue(undefined);
    (queueMock as any).mockReturnValue(undefined);
  });

  it("creates a document row from an uploadthing upload and queues ingestion", async () => {
    const service = new DocumentServiceImpl();

    const document = await service.createDocumentFromUpload({
      userId: "user-1",
      file: {
        name: "chemistry.pdf",
        size: 1024,
        type: "application/pdf",
        ufsUrl: "https://app_123.ufs.sh/f/file_abc123",
        fileHash: "hash-1",
      },
      title: "Chemistry Notes",
    });

    expect(prismaMock.documents.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        title: "Chemistry Notes",
        storagePath: "https://app_123.ufs.sh/f/file_abc123",
        contentHash: "hash-1",
      }),
    });
    expect(queueMock).toHaveBeenCalledWith("doc-1");
    expect(document.id).toBe("doc-1");
  });

  it("filters listed documents by title or original filename", async () => {
    const service = new DocumentServiceImpl();

    await service.listDocuments("user-1", {
      documentName: "chem",
    });

    expect(prismaMock.documents.findMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        visibility: DocumentVisibility.PRIVATE,
        origin: DocumentOrigin.USER_UPLOAD,
        OR: [
          {
            title: {
              contains: "chem",
              mode: "insensitive",
            },
          },
          {
            originalFilename: {
              contains: "chem",
              mode: "insensitive",
            },
          },
        ],
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  });

  it("deletes uploadthing-backed files by URL", async () => {
    const service = new DocumentServiceImpl();
    (prismaMock.documents.findFirst as any).mockResolvedValueOnce({
      id: "doc-1",
      userId: "user-1",
      visibility: DocumentVisibility.PRIVATE,
      origin: DocumentOrigin.USER_UPLOAD,
      title: "Chemistry Notes",
      originalFilename: "chemistry.pdf",
      mimeType: "application/pdf",
      storagePath: "https://app_123.ufs.sh/f/file_abc123",
      status: DocumentStatus.READY,
      sourceType: SourceType.PDF,
      byteSize: 1024,
      contentHash: "hash-1",
      chunkCount: 2,
      processingError: null,
      subject: null,
      createdAt: new Date("2026-04-11T10:00:00.000Z"),
      updatedAt: new Date("2026-04-11T10:00:00.000Z"),
    });

    await service.deleteDocument("user-1", "doc-1");

    expect(deleteUploadThingFileByUrlMock).toHaveBeenCalledWith(
      "https://app_123.ufs.sh/f/file_abc123",
    );
    expect(deleteStoredFileMock).not.toHaveBeenCalled();
  });

  it("falls back to local storage deletion for legacy records", async () => {
    const service = new DocumentServiceImpl();
    (prismaMock.documents.findFirst as any).mockResolvedValueOnce({
      id: "doc-1",
      userId: "user-1",
      visibility: DocumentVisibility.PRIVATE,
      origin: DocumentOrigin.USER_UPLOAD,
      title: "Chemistry Notes",
      originalFilename: "chemistry.pdf",
      mimeType: "application/pdf",
      storagePath: "user-1/chemistry.pdf",
      status: DocumentStatus.READY,
      sourceType: SourceType.PDF,
      byteSize: 1024,
      contentHash: "hash-1",
      chunkCount: 2,
      processingError: null,
      subject: null,
      createdAt: new Date("2026-04-11T10:00:00.000Z"),
      updatedAt: new Date("2026-04-11T10:00:00.000Z"),
    });

    await service.deleteDocument("user-1", "doc-1");

    expect(deleteStoredFileMock).toHaveBeenCalledWith("user-1/chemistry.pdf");
    expect(deleteUploadThingFileByUrlMock).not.toHaveBeenCalled();
  });
});
