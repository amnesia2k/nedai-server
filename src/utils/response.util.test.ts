import { describe, expect, it } from "bun:test";
import { Hono } from "hono";

import respond from "@/utils/response.util";

describe("respond", () => {
  it("returns a successful 200 response with payload", async () => {
    const app = new Hono();

    app.get("/ok", (c) => respond(c, 200, "OK", { user: "x" }));

    const response = await app.request("/ok");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      message: "OK",
      data: { user: "x" },
    });
  });

  it("returns a successful 201 response", async () => {
    const app = new Hono();

    app.get("/created", (c) => respond(c, 201, "Created", { id: "1" }));

    const response = await app.request("/created");

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      success: true,
      message: "Created",
      data: { id: "1" },
    });
  });

  it("treats non-200 2xx statuses as successful", async () => {
    const app = new Hono();

    app.get("/accepted", (c) => respond(c, 202, "Accepted"));

    const response = await app.request("/accepted");

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({
      success: true,
      message: "Accepted",
      data: {},
    });
  });

  it("returns false success for 400 responses", async () => {
    const app = new Hono();

    app.get("/bad-request", (c) => respond(c, 400, "Bad request"));

    const response = await app.request("/bad-request");

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      success: false,
      message: "Bad request",
      data: {},
    });
  });

  it("returns false success for 401 responses", async () => {
    const app = new Hono();

    app.get("/unauthorized", (c) => respond(c, 401, "Unauthorized"));

    const response = await app.request("/unauthorized");

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      success: false,
      message: "Unauthorized",
      data: {},
    });
  });

  it("returns false success for 500 responses", async () => {
    const app = new Hono();

    app.get("/server-error", (c) => respond(c, 500, "Internal server error"));

    const response = await app.request("/server-error");

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      success: false,
      message: "Internal server error",
      data: {},
    });
  });
});
