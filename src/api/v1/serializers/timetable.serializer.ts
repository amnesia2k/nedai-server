import type { TimetableActivity } from "@prisma/client";

export function serializeTimetableActivity(activity: TimetableActivity) {
  return {
    id: activity.id,
    userId: activity.userId,
    name: activity.name,
    dayOfWeek: activity.dayOfWeek,
    startTime: activity.startTime,
    endTime: activity.endTime,
    createdAt: activity.createdAt.toISOString(),
    updatedAt: activity.updatedAt.toISOString(),
  };
}
