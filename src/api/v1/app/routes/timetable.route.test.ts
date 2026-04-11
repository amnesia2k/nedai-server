import { beforeEach, describe, expect, it, mock } from "bun:test";
import { UserRole } from "@prisma/client";
import { Hono } from "hono";

import { issueAccessToken } from "@/lib/auth-token";
import { errorHandler } from "@/middleware/error-handler";
import type { AppBindings } from "@/middleware/auth";

const listActivitiesMock = mock(async () => []);
const createActivityMock = mock(async () => ({
  id: "activity-1",
  userId: "user-1",
  name: "Study group",
  dayOfWeek: "MONDAY",
  startTime: "09:00",
  endTime: "11:00",
  createdAt: "2026-04-10T09:00:00.000Z",
  updatedAt: "2026-04-10T09:00:00.000Z",
}));
const updateActivityMock = mock(async () => ({
  id: "activity-1",
  userId: "user-1",
  name: "Updated study group",
  dayOfWeek: "MONDAY",
  startTime: "10:00",
  endTime: "11:30",
  createdAt: "2026-04-10T09:00:00.000Z",
  updatedAt: "2026-04-10T10:00:00.000Z",
}));
const deleteActivityMock = mock(async () => {});

mock.module("@/api/v1/services/timetable.service", () => ({
  default: {
    listActivities: listActivitiesMock,
    createActivity: createActivityMock,
    updateActivity: updateActivityMock,
    deleteActivity: deleteActivityMock,
  },
}));

const { default: timetableRoutes } = await import(
  "@/api/v1/app/routes/timetable.route"
);

function createApp() {
  const app = new Hono<AppBindings>();
  app.route("/api/v1/timetable", timetableRoutes);
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

describe("timetable routes", () => {
  beforeEach(() => {
    listActivitiesMock.mockReset();
    createActivityMock.mockReset();
    updateActivityMock.mockReset();
    deleteActivityMock.mockReset();
    (listActivitiesMock as any).mockResolvedValue([]);
    (createActivityMock as any).mockResolvedValue({
      id: "activity-1",
      userId: "user-1",
      name: "Study group",
      dayOfWeek: "MONDAY",
      startTime: "09:00",
      endTime: "11:00",
      createdAt: "2026-04-10T09:00:00.000Z",
      updatedAt: "2026-04-10T09:00:00.000Z",
    });
    (updateActivityMock as any).mockResolvedValue({
      id: "activity-1",
      userId: "user-1",
      name: "Updated study group",
      dayOfWeek: "MONDAY",
      startTime: "10:00",
      endTime: "11:30",
      createdAt: "2026-04-10T09:00:00.000Z",
      updatedAt: "2026-04-10T10:00:00.000Z",
    });
    (deleteActivityMock as any).mockResolvedValue(undefined);
  });

  it("lists timetable activities for the authenticated user", async () => {
    const app = createApp();
    const headers = await createAuthHeader();

    const response = await app.request("/api/v1/timetable/activities", {
      headers,
    });

    expect(response.status).toBe(200);
    expect(listActivitiesMock).toHaveBeenCalledWith("user-1");
  });

  it("creates a timetable activity", async () => {
    const app = createApp();
    const headers = await createAuthHeader();

    const response = await app.request("/api/v1/timetable/activities", {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Study group",
        dayOfWeek: "MONDAY",
        startTime: "09:00",
        endTime: "11:00",
      }),
    });

    expect(response.status).toBe(201);
    expect(createActivityMock).toHaveBeenCalledWith("user-1", {
      name: "Study group",
      dayOfWeek: "MONDAY",
      startTime: "09:00",
      endTime: "11:00",
    });
  });

  it("updates a timetable activity", async () => {
    const app = createApp();
    const headers = await createAuthHeader();

    const response = await app.request(
      "/api/v1/timetable/activities/4ef48063-5a9b-434f-aa5e-3192aaf59a3f",
      {
        method: "PATCH",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Updated study group",
          startTime: "10:00",
          endTime: "11:30",
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(updateActivityMock).toHaveBeenCalledWith(
      "user-1",
      "4ef48063-5a9b-434f-aa5e-3192aaf59a3f",
      {
        name: "Updated study group",
        startTime: "10:00",
        endTime: "11:30",
      },
    );
  });

  it("deletes a timetable activity", async () => {
    const app = createApp();
    const headers = await createAuthHeader();

    const response = await app.request(
      "/api/v1/timetable/activities/4ef48063-5a9b-434f-aa5e-3192aaf59a3f",
      {
        method: "DELETE",
        headers,
      },
    );

    expect(response.status).toBe(204);
    expect(deleteActivityMock).toHaveBeenCalledWith(
      "user-1",
      "4ef48063-5a9b-434f-aa5e-3192aaf59a3f",
    );
  });
});
