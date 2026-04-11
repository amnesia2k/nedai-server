import { Hono } from "hono";

import type { AppBindings } from "@/middleware/auth";
import { requireAuth } from "@/middleware/auth";
import {
  clearChats,
  getChatMessages,
  listChats,
  sendMessage,
} from "@/api/v1/app/controllers/chat.controller";

const router = new Hono<AppBindings>();

router.use("*", requireAuth);
router.get("/", listChats);
router.delete("/", clearChats);
router.get("/:chatId/messages", getChatMessages);
router.post("/messages", sendMessage);

export default router;
