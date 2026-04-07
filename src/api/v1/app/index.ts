import { Hono } from "hono";

import type { AppBindings } from "@/middleware/auth";
import authRoutes from "@/api/v1/app/routes/auth.route";
import chatRoutes from "@/api/v1/app/routes/chat.route";
import userRoutes from "@/api/v1/app/routes/user.route";

const router = new Hono<AppBindings>();

router.route("/auth", authRoutes);
router.route("/chats", chatRoutes);
router.route("/", userRoutes);

export default router;
