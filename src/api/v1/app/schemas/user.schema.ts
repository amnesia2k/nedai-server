import { z } from "zod";

export const updateCurrentUserSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Name must be at least 2 characters")
      .max(100, "Name must be 100 characters or fewer")
      .optional(),
  })
  .strict()
  .refine((data) => data.name !== undefined, {
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
