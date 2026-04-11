import { beforeEach, describe, expect, it, mock } from "bun:test";
import { UserRole } from "@prisma/client";
import { Hono } from "hono";

import { issueAccessToken } from "@/lib/auth-token";
import { errorHandler } from "@/middleware/error-handler";
import type { AppBindings } from "@/middleware/auth";

const baseUser = {
  id: "user-1",
  fullName: "John Doe",
  preferredName: null,
  aboutMe: null,
  likes: [],
  dislikes: [],
  learningPreferences: [],
  email: "user@example.com",
  role: "STUDENT",
  institution: null,
  department: null,
  matricNumber: null,
  staffId: null,
  studentAcademicLevel: null,
  dateOfBirth: null,
  lecturerHighestQualification: null,
  lecturerCurrentAcademicStage: null,
  profileCompletion: {
    isComplete: false,
    missingFields: [
      "institution",
      "studentAcademicLevel",
      "matricNumber",
      "dateOfBirth",
    ],
  },
  createdAt: "2026-04-07T08:00:00.000Z",
  updatedAt: "2026-04-07T08:00:00.000Z",
};

const getCurrentUserMock = mock(async () => baseUser);
const updateCurrentUserMock = mock(async () => ({
  ...baseUser,
  fullName: "Jane Doe",
  institution: "NedAI University",
  matricNumber: "MAT-001",
  studentAcademicLevel: "400 Level",
  dateOfBirth: "2000-10-12",
  profileCompletion: {
    isComplete: true,
    missingFields: [],
  },
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
    (getCurrentUserMock as any).mockResolvedValue(baseUser);
    (updateCurrentUserMock as any).mockResolvedValue({
      ...baseUser,
      fullName: "Jane Doe",
      institution: "NedAI University",
      matricNumber: "MAT-001",
      studentAcademicLevel: "400 Level",
      dateOfBirth: "2000-10-12",
      profileCompletion: {
        isComplete: true,
        missingFields: [],
      },
      updatedAt: "2026-04-07T08:05:00.000Z",
    });
    (changeCurrentPasswordMock as any).mockResolvedValue(undefined);
  });

  it("requires auth on GET /me", async () => {
    const app = createApp();
    const response = await app.request("/api/v1/me");
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.message).toBe("Unauthorized");
  });

  it("gets the current user for the authenticated user", async () => {
    const app = createApp();
    const headers = await createAuthHeader();
    (getCurrentUserMock as any).mockResolvedValueOnce(baseUser);

    const response = await app.request("/api/v1/me", { headers });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(getCurrentUserMock).toHaveBeenCalledWith("user-1");
    expect(body.data.user.profileCompletion.isComplete).toBe(false);
  });

  it("updates the current user profile", async () => {
    const app = createApp();
    const headers = await createAuthHeader();

    const response = await app.request("/api/v1/me", {
      method: "PATCH",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fullName: "Jane Doe",
        institution: "NedAI University",
        matricNumber: "MAT-001",
        studentAcademicLevel: "400 Level",
        dateOfBirth: "2000-10-12",
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(updateCurrentUserMock).toHaveBeenCalledWith("user-1", {
      fullName: "Jane Doe",
      institution: "NedAI University",
      matricNumber: "MAT-001",
      studentAcademicLevel: "400 Level",
      dateOfBirth: "2000-10-12",
    });
    expect(body.data.user.profileCompletion.isComplete).toBe(true);
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
    expect(body.data).toEqual({});
  });
});
