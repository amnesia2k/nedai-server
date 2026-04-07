import { Hono } from "hono";

import type { AppBindings } from "@/middleware/auth";
import {
  loginUser,
  registerUser,
} from "@/api/v1/app/controllers/auth.controller";

const router = new Hono<AppBindings>();

router.post("/register", registerUser);
router.post("/login", loginUser);

export default router;
