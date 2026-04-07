import type { Context } from "hono";

import type { AppBindings } from "@/middleware/auth";
import AuthService from "@/api/v1/services/auth.service";
import respond from "@/utils/response.util";

export async function registerUser(c: Context<AppBindings>) {
  const body = await c.req.json();
  const result = await AuthService.register(body);

  return respond(c, 201, "Registration successful", result);
}

export async function loginUser(c: Context<AppBindings>) {
  const body = await c.req.json();
  const result = await AuthService.login(body);

  return respond(c, 200, "Login successful", result);
}
