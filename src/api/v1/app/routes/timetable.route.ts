import { Hono } from "hono";

import type { AppBindings } from "@/middleware/auth";
import { requireAuth } from "@/middleware/auth";
import {
  createTimetableActivity,
  deleteTimetableActivity,
  listTimetableActivities,
  updateTimetableActivity,
} from "@/api/v1/app/controllers/timetable.controller";

const router = new Hono<AppBindings>();

router.use("*", requireAuth);
router.get("/activities", listTimetableActivities);
router.post("/activities", createTimetableActivity);
router.patch("/activities/:activityId", updateTimetableActivity);
router.delete("/activities/:activityId", deleteTimetableActivity);

export default router;
