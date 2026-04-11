import { z } from "zod";

export const updateCurrentUserSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, "Full name must be at least 2 characters")
      .max(100, "Full name must be 100 characters or fewer")
      .optional(),
    institution: z
      .string()
      .trim()
      .min(2, "Institution must be at least 2 characters")
      .max(120, "Institution must be 120 characters or fewer")
      .nullable()
      .optional(),
    matricNumber: z
      .string()
      .trim()
      .min(1, "Matric number cannot be empty")
      .max(50, "Matric number must be 50 characters or fewer")
      .nullable()
      .optional(),
    studentAcademicLevel: z
      .string()
      .trim()
      .min(1, "Academic level cannot be empty")
      .max(80, "Academic level must be 80 characters or fewer")
      .nullable()
      .optional(),
    dateOfBirth: z
      .string()
      .date("Date of birth must use YYYY-MM-DD format")
      .nullable()
      .optional(),
    lecturerHighestQualification: z
      .string()
      .trim()
      .min(1, "Highest qualification cannot be empty")
      .max(120, "Highest qualification must be 120 characters or fewer")
      .nullable()
      .optional(),
    lecturerCurrentAcademicStage: z
      .string()
      .trim()
      .min(1, "Current academic stage cannot be empty")
      .max(120, "Current academic stage must be 120 characters or fewer")
      .nullable()
      .optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export const changePasswordSchema = z
  .object({
    oldPassword: z
      .string()
      .min(1, "Current password is required")
      .max(128, "Password must be 128 characters or fewer"),
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(128, "Password must be 128 characters or fewer"),
  })
  .strict()
  .refine((data) => data.oldPassword !== data.newPassword, {
    message: "New password must be different from current password",
  });

export type UpdateCurrentUserInput = z.infer<typeof updateCurrentUserSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
