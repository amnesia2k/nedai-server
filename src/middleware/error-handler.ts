import type { Prisma } from "@prisma/client";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { ZodError } from "zod";

import { ApiError } from "@/lib/api-error";
import respond from "@/utils/response.util";

function isPrismaKnownRequestError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string"
  );
}

function hasEmailTarget(target: unknown): boolean {
  if (!Array.isArray(target)) {
    return false;
  }

  return target.includes("email");
}

function isZodError(error: unknown): error is ZodError {
  return error instanceof ZodError || (typeof error === "object" && error !== null && "issues" in error && Array.isArray((error as { issues: unknown }).issues));
}

export function errorHandler(error: Error, c: Context) {
  if (error instanceof ApiError) {
    return respond(c, error.statusCode as ContentfulStatusCode, error.message);
  }

  if (isZodError(error)) {
    const firstIssue = error.issues[0];

    return respond(c, 400, firstIssue?.message ?? "Invalid request body");
  }

  if (isPrismaKnownRequestError(error) && error.code === "P2002" && hasEmailTarget(error.meta?.target)) {
    return respond(c, 409, "An account with this email already exists");
  }

  console.error(error);

  return respond(c, 500, "Internal server error");
}
