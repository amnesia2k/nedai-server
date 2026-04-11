import { Hono } from "hono";

import type { AppBindings } from "@/middleware/auth";
import { requireAuth } from "@/middleware/auth";
import {
  createDocument,
  deleteDocument,
  getDocument,
  listDocuments,
  reprocessDocument,
} from "@/api/v1/app/controllers/document.controller";

const router = new Hono<AppBindings>();

router.use("*", requireAuth);
router.get("/", listDocuments);
router.post("/", createDocument);
router.get("/:documentId", getDocument);
router.delete("/:documentId", deleteDocument);
router.post("/:documentId/reprocess", reprocessDocument);

export default router;
