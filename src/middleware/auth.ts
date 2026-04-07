import type { UserRole } from "@prisma/client";
import type { Context, Next } from "hono";
import { verify } from "hono/jwt";

import type { AccessTokenPayload } from "@/lib/auth-token";
import { env } from "@/utils/env";
import respond from "@/utils/response.util";

export type AppBindings = {
  Variables: {
    jwtPayload: AccessTokenPayload;
  };
};

function getUnauthorizedResponse(c: Context, message = "Unauthorized") {
  return respond(c, 401, message);
}

export async function requireAuth(c: Context<AppBindings>, next: Next) {
  const authorization = c.req.header("Authorization");

  if (!authorization || !authorization.startsWith("Bearer ")) {
    return getUnauthorizedResponse(c);
  }

  const token = authorization.slice("Bearer ".length).trim();

  if (!token) {
    return getUnauthorizedResponse(c);
  }

  try {
    const payload = await verify(token, env.JWT_SECRET, "HS256");

    if (
      typeof payload.sub !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.role !== "string" ||
      payload.type !== "access"
    ) {
      return getUnauthorizedResponse(c);
    }

    c.set("jwtPayload", {
      sub: payload.sub,
      email: payload.email,
      role: payload.role as UserRole,
      type: "access",
      exp: typeof payload.exp === "number" ? payload.exp : 0,
    });

    await next();
  } catch {
    return getUnauthorizedResponse(c);
  }
}

export function getJwtPayload(c: Context<AppBindings>): AccessTokenPayload {
  return c.get("jwtPayload");
}
