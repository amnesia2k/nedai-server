import type { Context } from "hono";

import { getJwtPayload, type AppBindings } from "@/middleware/auth";
import AuthService from "@/api/v1/services/auth.service";
import respond from "@/utils/response.util";

export async function getCurrentUser(c: Context<AppBindings>) {
  const payload = getJwtPayload(c);
  const user = await AuthService.getCurrentUser(payload.sub);

  return respond(c, 200, "Current user fetched successfully", {
    user,
  });
}

export async function updateCurrentUser(c: Context<AppBindings>) {
  const payload = getJwtPayload(c);
  const body = await c.req.json();
  const user = await AuthService.updateCurrentUser(payload.sub, body);

  return respond(c, 200, "Profile updated successfully", {
    user,
  });
}

export async function changeCurrentPassword(c: Context<AppBindings>) {
  const payload = getJwtPayload(c);
  const body = await c.req.json();

  await AuthService.changeCurrentPassword(payload.sub, body);

  return respond(c, 200, "Password changed successfully");
}
