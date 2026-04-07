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
