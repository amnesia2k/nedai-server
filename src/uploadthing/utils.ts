import type { UserRole } from "@prisma/client";
import { verify } from "hono/jwt";
import { UploadThingError } from "uploadthing/server";

import type { AccessTokenPayload } from "@/lib/auth-token";
import { ApiError } from "@/lib/api-error";
import { env } from "@/utils/env";

function isAccessTokenPayload(value: unknown): value is AccessTokenPayload {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { sub?: unknown }).sub === "string" &&
    typeof (value as { email?: unknown }).email === "string" &&
    typeof (value as { role?: unknown }).role === "string" &&
    (value as { type?: unknown }).type === "access"
  );
}

export async function verifyUploadThingRequest(
  request: Request,
): Promise<AccessTokenPayload> {
  const authorization = request.headers.get("Authorization");

  if (!authorization || !authorization.startsWith("Bearer ")) {
    throw new UploadThingError({
      code: "FORBIDDEN",
      message: "Unauthorized",
    });
  }

  const token = authorization.slice("Bearer ".length).trim();

  if (!token) {
    throw new UploadThingError({
      code: "FORBIDDEN",
      message: "Unauthorized",
    });
  }

  try {
    const payload = await verify(token, env.JWT_SECRET, "HS256");

    if (!isAccessTokenPayload(payload)) {
      throw new UploadThingError({
        code: "FORBIDDEN",
        message: "Unauthorized",
      });
    }

    return {
      sub: payload.sub,
      email: payload.email,
      role: payload.role as UserRole,
      type: "access",
      exp: typeof payload.exp === "number" ? payload.exp : 0,
    };
  } catch (error) {
    if (error instanceof UploadThingError) {
      throw error;
    }

    throw new UploadThingError({
      code: "FORBIDDEN",
      message: "Unauthorized",
      cause: error,
    });
  }
}

export function getUploadThingFileKey(fileUrl: string): string | null {
  try {
    const url = new URL(fileUrl);
    const segments = url.pathname.split("/").filter(Boolean);

    return segments.at(-1) ?? null;
  } catch {
    return null;
  }
}

export function isRemoteFileUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function toUploadThingError(error: unknown) {
  if (error instanceof UploadThingError) {
    return error;
  }

  if (error instanceof ApiError) {
    const code =
      error.statusCode === 401 || error.statusCode === 403
        ? "FORBIDDEN"
        : error.statusCode === 404
          ? "NOT_FOUND"
          : error.statusCode === 413
            ? "TOO_LARGE"
            : error.statusCode >= 500
              ? "INTERNAL_SERVER_ERROR"
              : "BAD_REQUEST";

    return new UploadThingError({
      code,
      message: error.message,
      cause: error,
    });
  }

  if (error instanceof Error) {
    return new UploadThingError({
      code: "INTERNAL_SERVER_ERROR",
      message: error.message || "Internal server error",
      cause: error,
    });
  }

  return new UploadThingError({
    code: "INTERNAL_SERVER_ERROR",
    message: "Internal server error",
    cause: error,
  });
}
