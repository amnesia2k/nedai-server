import type { Context } from "hono";

import type { AppBindings } from "@/middleware/auth";
import { getJwtPayload } from "@/middleware/auth";
import { timetableActivityParamsSchema } from "@/api/v1/app/schemas/timetable.schema";
import TimetableService from "@/api/v1/services/timetable.service";
import respond from "@/utils/response.util";

export async function listTimetableActivities(c: Context<AppBindings>) {
  const payload = getJwtPayload(c);
  const activities = await TimetableService.listActivities(payload.sub);

  return respond(c, 200, "Timetable activities fetched successfully", {
    activities,
  });
}

export async function createTimetableActivity(c: Context<AppBindings>) {
  const payload = getJwtPayload(c);
  const body = await c.req.json();
  const activity = await TimetableService.createActivity(payload.sub, body);

  return respond(c, 201, "Timetable activity created successfully", {
    activity,
  });
}

export async function updateTimetableActivity(c: Context<AppBindings>) {
  const payload = getJwtPayload(c);
  const params = timetableActivityParamsSchema.parse(c.req.param());
  const body = await c.req.json();
  const activity = await TimetableService.updateActivity(
    payload.sub,
    params.activityId,
    body,
  );

  return respond(c, 200, "Timetable activity updated successfully", {
    activity,
  });
}

export async function deleteTimetableActivity(c: Context<AppBindings>) {
  const payload = getJwtPayload(c);
  const params = timetableActivityParamsSchema.parse(c.req.param());
  await TimetableService.deleteActivity(payload.sub, params.activityId);

  return c.body(null, 204);
}
