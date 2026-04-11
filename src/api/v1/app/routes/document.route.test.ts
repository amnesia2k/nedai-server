import { beforeEach, describe, expect, it, mock } from "bun:test";
import { UserRole } from "@prisma/client";
import { Hono } from "hono";

import { issueAccessToken } from "@/lib/auth-token";
import { errorHandler } from "@/middleware/error-handler";
import type { AppBindings } from "@/middleware/auth";

const listDocumentsMock = mock(async () => ({
  documents: [],
  quota: {
    maxDocuments: 10,
    usedDocuments: 0,
    maxBytes: 26214400,
    usedBytes: 0,
  },
}));
const uploadDocumentMock = mock(async () => ({
  id: "doc-1",
  title: "Lecture 1",
  originalFilename: "lecture-1.docx",
  sourceType: "DOCX",
  status: "UPLOADED",
  byteSize: 1024,
  chunkCount: 0,
  processingError: null,
  createdAt: "2026-04-10T09:00:00.000Z",
  updatedAt: "2026-04-10T09:00:00.000Z",
}));
const getDocumentMock = mock(async () => uploadDocumentMock());
const deleteDocumentMock = mock(async () => {});
const reprocessDocumentMock = mock(async () => ({
  ...uploadDocumentMock(),
  status: "UPLOADED",
}));

mock.module("@/api/v1/services/document.service", () => ({
  default: {
    listDocuments: listDocumentsMock,
    uploadDocument: uploadDocumentMock,
    getDocument: getDocumentMock,
    deleteDocument: deleteDocumentMock,
    reprocessDocument: reprocessDocumentMock,
  },
}));

const { default: documentRoutes } = await import(
  "@/api/v1/app/routes/document.route"
);

function createApp() {
  const app = new Hono<AppBindings>();
  app.route("/api/v1/documents", documentRoutes);
  app.onError(errorHandler);
  return app;
}

async function createAuthHeader() {
  const token = await issueAccessToken({
    id: "user-1",
    email: "user@example.com",
    role: UserRole.STUDENT,
  });

  return {
    Authorization: `Bearer ${token}`,
  };
}

describe("document routes", () => {
  beforeEach(() => {
    listDocumentsMock.mockReset();
    uploadDocumentMock.mockReset();
    getDocumentMock.mockReset();
    deleteDocumentMock.mockReset();
    reprocessDocumentMock.mockReset();
    (listDocumentsMock as any).mockResolvedValue({
      documents: [],
      quota: {
        maxDocuments: 10,
        usedDocuments: 0,
        maxBytes: 26214400,
        usedBytes: 0,
      },
    });
    (uploadDocumentMock as any).mockResolvedValue({
      id: "doc-1",
      title: "Lecture 1",
      originalFilename: "lecture-1.docx",
      sourceType: "DOCX",
      status: "UPLOADED",
      byteSize: 1024,
      chunkCount: 0,
      processingError: null,
      createdAt: "2026-04-10T09:00:00.000Z",
      updatedAt: "2026-04-10T09:00:00.000Z",
    });
    (getDocumentMock as any).mockResolvedValue({
      id: "doc-1",
      title: "Lecture 1",
      originalFilename: "lecture-1.docx",
      sourceType: "DOCX",
      status: "UPLOADED",
      byteSize: 1024,
      chunkCount: 0,
      processingError: null,
      createdAt: "2026-04-10T09:00:00.000Z",
      updatedAt: "2026-04-10T09:00:00.000Z",
    });
    (deleteDocumentMock as any).mockResolvedValue(undefined);
    (reprocessDocumentMock as any).mockResolvedValue({
      id: "doc-1",
      title: "Lecture 1",
      originalFilename: "lecture-1.docx",
      sourceType: "DOCX",
      status: "UPLOADED",
      byteSize: 1024,
      chunkCount: 0,
      processingError: null,
      createdAt: "2026-04-10T09:00:00.000Z",
      updatedAt: "2026-04-10T09:00:00.000Z",
    });
  });

  it("lists owned documents", async () => {
    const app = createApp();
    const headers = await createAuthHeader();
    (listDocumentsMock as any).mockResolvedValueOnce({
      documents: [],
      quota: {
        maxDocuments: 10,
        usedDocuments: 0,
        maxBytes: 26214400,
        usedBytes: 0,
      },
    });

    const response = await app.request("/api/v1/documents", { headers });
    expect(response.status).toBe(200);
    expect(listDocumentsMock).toHaveBeenCalledWith("user-1", undefined);
  });

  it("passes the optional documentName filter to the service", async () => {
    const app = createApp();
    const headers = await createAuthHeader();

    const response = await app.request("/api/v1/documents?documentName=chem", {
      headers,
    });

    expect(response.status).toBe(200);
    expect(listDocumentsMock).toHaveBeenCalledWith("user-1", {
      documentName: "chem",
    });
  });

  it("returns 410 for legacy multipart uploads", async () => {
    const app = createApp();
    const headers = await createAuthHeader();

    const response = await app.request("/api/v1/documents", {
      method: "POST",
      headers,
    });

    expect(response.status).toBe(410);
    expect(uploadDocumentMock).not.toHaveBeenCalled();
  });

  it("gets an owned document", async () => {
    const app = createApp();
    const headers = await createAuthHeader();

    const response = await app.request(
      "/api/v1/documents/9a8a7c29-12c7-4a5d-b1da-1cf2b44ceb93",
      { headers },
    );

    expect(response.status).toBe(200);
    expect(getDocumentMock).toHaveBeenCalledWith(
      "user-1",
      "9a8a7c29-12c7-4a5d-b1da-1cf2b44ceb93",
    );
  });

  it("reprocesses an owned document", async () => {
    const app = createApp();
    const headers = await createAuthHeader();

    const response = await app.request(
      "/api/v1/documents/9a8a7c29-12c7-4a5d-b1da-1cf2b44ceb93/reprocess",
      {
        method: "POST",
        headers,
      },
    );

    expect(response.status).toBe(202);
    expect(reprocessDocumentMock).toHaveBeenCalledWith(
      "user-1",
      "9a8a7c29-12c7-4a5d-b1da-1cf2b44ceb93",
    );
  });

  it("deletes an owned document", async () => {
    const app = createApp();
    const headers = await createAuthHeader();

    const response = await app.request(
      "/api/v1/documents/9a8a7c29-12c7-4a5d-b1da-1cf2b44ceb93",
      {
        method: "DELETE",
        headers,
      },
    );

    expect(response.status).toBe(204);
    expect(deleteDocumentMock).toHaveBeenCalledWith(
      "user-1",
      "9a8a7c29-12c7-4a5d-b1da-1cf2b44ceb93",
    );
  });
});
