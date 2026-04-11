import { z } from "zod";

const hhmmSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must use HH:MM format");

const weekdaySchema = z.enum([
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
]);

export const timetableActivityParamsSchema = z
  .object({
    activityId: z.string().uuid("Activity ID must be a valid UUID"),
  })
  .strict();

export const createTimetableActivitySchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Activity name is required")
      .max(120, "Activity name must be 120 characters or fewer"),
    dayOfWeek: weekdaySchema,
    startTime: hhmmSchema,
    endTime: hhmmSchema,
  })
  .strict()
  .refine((data) => data.endTime > data.startTime, {
    message: "End time must be after start time",
    path: ["endTime"],
  });

export const updateTimetableActivitySchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Activity name is required")
      .max(120, "Activity name must be 120 characters or fewer")
      .optional(),
    dayOfWeek: weekdaySchema.optional(),
    startTime: hhmmSchema.optional(),
    endTime: hhmmSchema.optional(),
  })
  .strict()
  .refine(
    (data) =>
      Object.keys(data).length > 0 &&
      (!data.startTime || !data.endTime || data.endTime > data.startTime),
    {
      message: "End time must be after start time",
      path: ["endTime"],
    },
  );

export type TimetableActivityParams = z.infer<
  typeof timetableActivityParamsSchema
>;
export type CreateTimetableActivityInput = z.infer<
  typeof createTimetableActivitySchema
>;
export type UpdateTimetableActivityInput = z.infer<
  typeof updateTimetableActivitySchema
>;
