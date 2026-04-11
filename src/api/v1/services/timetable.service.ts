import { ApiError } from "@/lib/api-error";
import prisma from "@/lib/prisma";
import {
  createTimetableActivitySchema,
  updateTimetableActivitySchema,
} from "@/api/v1/app/schemas/timetable.schema";
import { serializeTimetableActivity } from "@/api/v1/serializers/timetable.serializer";

export class TimetableServiceImpl {
  public async listActivities(userId: string) {
    const activities = await prisma.timetableActivity.findMany({
      where: { userId },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });

    return activities.map(serializeTimetableActivity);
  }

  public async createActivity(userId: string, payload: unknown) {
    const data = createTimetableActivitySchema.parse(payload);
    const activity = await prisma.timetableActivity.create({
      data: {
        userId,
        ...data,
      },
    });

    return serializeTimetableActivity(activity);
  }

  public async updateActivity(
    userId: string,
    activityId: string,
    payload: unknown,
  ) {
    const data = updateTimetableActivitySchema.parse(payload);
    const existingActivity = await prisma.timetableActivity.findFirst({
      where: {
        id: activityId,
        userId,
      },
    });

    if (!existingActivity) {
      throw new ApiError(404, "Timetable activity not found");
    }

    const nextStartTime = data.startTime ?? existingActivity.startTime;
    const nextEndTime = data.endTime ?? existingActivity.endTime;

    if (nextEndTime <= nextStartTime) {
      throw new ApiError(400, "End time must be after start time");
    }

    const activity = await prisma.timetableActivity.update({
      where: {
        id: activityId,
      },
      data,
    });

    return serializeTimetableActivity(activity);
  }

  public async deleteActivity(userId: string, activityId: string) {
    const existingActivity = await prisma.timetableActivity.findFirst({
      where: {
        id: activityId,
        userId,
      },
      select: {
        id: true,
      },
    });

    if (!existingActivity) {
      throw new ApiError(404, "Timetable activity not found");
    }

    await prisma.timetableActivity.delete({
      where: {
        id: activityId,
      },
    });
  }
}

const TimetableService = new TimetableServiceImpl();

export default TimetableService;
