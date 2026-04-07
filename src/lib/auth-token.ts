import type { UserRole } from "@prisma/client";
import { sign } from "hono/jwt";

import { env } from "@/utils/env";

export const ACCESS_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

export type AccessTokenPayload = {
  sub: string;
  email: string;
  role: UserRole;
  type: "access";
  exp: number;
};

type TokenUser = {
  id: string;
  email: string;
  role: UserRole;
};

export function buildAccessTokenPayload(user: TokenUser): AccessTokenPayload {
  const exp = Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL_SECONDS;

  return {
    sub: user.id,
    email: user.email,
    role: user.role,
    type: "access",
    exp,
  };
}

export async function issueAccessToken(user: TokenUser): Promise<string> {
  const payload = buildAccessTokenPayload(user);
  return sign(payload, env.JWT_SECRET, "HS256");
}
