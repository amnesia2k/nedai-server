import type { Context } from "hono";

import type { AppBindings } from "@/middleware/auth";
import { getJwtPayload } from "@/middleware/auth";
import { documentParamsSchema } from "@/api/v1/app/schemas/document.schema";
import DocumentService from "@/api/v1/services/document.service";
import respond from "@/utils/response.util";

export async function listDocuments(c: Context<AppBindings>) {
  const payload = getJwtPayload(c);
  const result = await DocumentService.listDocuments(payload.sub);

  return respond(c, 200, "Documents fetched successfully", result);
}

export async function createDocument(c: Context<AppBindings>) {
  const payload = getJwtPayload(c);
  const formData = await c.req.formData();
  const document = await DocumentService.uploadDocument(payload.sub, formData);

  return respond(c, 202, "Document upload accepted", {
    document,
  });
}

export async function getDocument(c: Context<AppBindings>) {
  const payload = getJwtPayload(c);
  const params = documentParamsSchema.parse(c.req.param());
  const document = await DocumentService.getDocument(payload.sub, params.documentId);

  return respond(c, 200, "Document fetched successfully", {
    document,
  });
}

export async function deleteDocument(c: Context<AppBindings>) {
  const payload = getJwtPayload(c);
  const params = documentParamsSchema.parse(c.req.param());
  await DocumentService.deleteDocument(payload.sub, params.documentId);

  return c.body(null, 204);
}

export async function reprocessDocument(c: Context<AppBindings>) {
  const payload = getJwtPayload(c);
  const params = documentParamsSchema.parse(c.req.param());
  const document = await DocumentService.reprocessDocument(
    payload.sub,
    params.documentId,
  );

  return respond(c, 202, "Document reprocessing accepted", {
    document,
  });
}
