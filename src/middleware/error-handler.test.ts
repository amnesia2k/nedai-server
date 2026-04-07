import { describe, expect, it } from "bun:test";
import { Hono } from "hono";

import { ApiError } from "@/lib/api-error";
import { registerSchema } from "@/api/v1/app/schemas/auth.schema";
import { errorHandler } from "@/middleware/error-handler";

describe("errorHandler", () => {
  it("maps ApiError to the provided status code", async () => {
    const app = new Hono();

    app.get("/unauthorized", () => {
      throw new ApiError(401, "Unauthorized");
    });
    app.onError(errorHandler);

    const response = await app.request("/unauthorized");

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      success: false,
      message: "Unauthorized",
      data: {},
    });
  });

  it("maps ZodError to a 400 response", async () => {
    const app = new Hono();

    app.get("/invalid", () => {
      registerSchema.parse({
        name: "John Doe",
        email: "not-an-email",
        password: "secret123",
      });

      return new Response("ok");
    });
    app.onError(errorHandler);

    const response = await app.request("/invalid");

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      success: false,
      message: "Email must be a valid email address",
      data: {},
    });
  });

  it("maps unknown errors to a 500 response", async () => {
    const app = new Hono();
    const originalConsoleError = console.error;

    app.get("/boom", () => {
      throw new Error("boom");
    });
    app.onError(errorHandler);

    console.error = () => {};

    try {
      const response = await app.request("/boom");

      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({
        success: false,
        message: "Internal server error",
        data: {},
      });
    } finally {
      console.error = originalConsoleError;
    }
  });
});
