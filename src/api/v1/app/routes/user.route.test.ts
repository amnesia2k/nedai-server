import { beforeEach, describe, expect, it, mock } from "bun:test";
import { UserRole } from "@prisma/client";
import { Hono } from "hono";

import { issueAccessToken } from "@/lib/auth-token";
import { errorHandler } from "@/middleware/error-handler";
import type { AppBindings } from "@/middleware/auth";

const getCurrentUserMock = mock(async () => ({
  id: "user-1",
  name: "John Doe",
  email: "user@example.com",
  role: "STUDENT",
  institution: null,
  createdAt: "2026-04-07T08:00:00.000Z",
  updatedAt: "2026-04-07T08:00:00.000Z",
}));
const updateCurrentUserMock = mock(async () => ({
  id: "user-1",
  name: "Jane Doe",
  email: "user@example.com",
  role: "STUDENT",
  institution: null,
  createdAt: "2026-04-07T08:00:00.000Z",
  updatedAt: "2026-04-07T08:05:00.000Z",
}));
const changeCurrentPasswordMock = mock(async () => {});

mock.module("@/api/v1/services/auth.service", () => ({
  default: {
    getCurrentUser: getCurrentUserMock,
    updateCurrentUser: updateCurrentUserMock,
    changeCurrentPassword: changeCurrentPasswordMock,
  },
}));

const { default: userRoutes } = await import("@/api/v1/app/routes/user.route");

function createApp() {
  const app = new Hono<AppBindings>();
  app.route("/api/v1", userRoutes);
  app.onError(errorHandler);
  return app;
}

async function createAuthHeader() {
  const token = await issueAccessToken({
    id: "user-1",
    email: "user@example.com",
    role: UserRole.STUDENT,
  });

  return {
    Authorization: `Bearer ${token}`,
  };
}

describe("user routes", () => {
  beforeEach(() => {
    getCurrentUserMock.mockReset();
    updateCurrentUserMock.mockReset();
    changeCurrentPasswordMock.mockReset();
  });

  it("requires auth on GET /me", async () => {
    const app = createApp();
    const response = await app.request("/api/v1/me");
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.message).toBe("Unauthorized");
  });

  it("requires auth on PATCH /me", async () => {
    const app = createApp();
    const response = await app.request("/api/v1/me", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Jane Doe",
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.message).toBe("Unauthorized");
  });

  it("requires auth on PATCH /me/password", async () => {
    const app = createApp();
    const response = await app.request("/api/v1/me/password", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        oldPassword: "old-password",
        newPassword: "new-password-123",
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.message).toBe("Unauthorized");
  });

  it("gets the current user for the authenticated user", async () => {
    const app = createApp();
    const headers = await createAuthHeader();

    (getCurrentUserMock as any).mockResolvedValueOnce({
      id: "user-1",
      name: "John Doe",
      email: "user@example.com",
      role: "STUDENT",
      institution: null,
      createdAt: "2026-04-07T08:00:00.000Z",
      updatedAt: "2026-04-07T08:00:00.000Z",
    });

    const response = await app.request("/api/v1/me", { headers });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(getCurrentUserMock).toHaveBeenCalledWith("user-1");
    expect(body.data.user.name).toBe("John Doe");
  });

  it("updates the current user profile", async () => {
    const app = createApp();
    const headers = await createAuthHeader();

    (updateCurrentUserMock as any).mockResolvedValueOnce({
      id: "user-1",
      name: "Jane Doe",
      email: "user@example.com",
      role: "STUDENT",
      institution: null,
      createdAt: "2026-04-07T08:00:00.000Z",
      updatedAt: "2026-04-07T08:05:00.000Z",
    });

    const response = await app.request("/api/v1/me", {
      method: "PATCH",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Jane Doe",
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(updateCurrentUserMock).toHaveBeenCalledWith("user-1", {
      name: "Jane Doe",
    });
    expect(body.message).toBe("Profile updated successfully");
    expect(body.data.user.name).toBe("Jane Doe");
  });

  it("changes the current user password", async () => {
    const app = createApp();
    const headers = await createAuthHeader();

    const response = await app.request("/api/v1/me/password", {
      method: "PATCH",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        oldPassword: "old-password",
        newPassword: "new-password-123",
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(changeCurrentPasswordMock).toHaveBeenCalledWith("user-1", {
      oldPassword: "old-password",
      newPassword: "new-password-123",
    });
    expect(body.message).toBe("Password changed successfully");
    expect(body.data).toEqual({});
  });
});
