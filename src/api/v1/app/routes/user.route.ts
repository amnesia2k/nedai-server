import { Hono } from "hono";

import { requireAuth, type AppBindings } from "@/middleware/auth";
import { getCurrentUser } from "@/api/v1/app/controllers/user.controller";

const router = new Hono<AppBindings>();

router.use("/me", requireAuth);
router.get("/me", getCurrentUser);

export default router;
