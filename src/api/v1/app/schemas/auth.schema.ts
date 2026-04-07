import { z } from "zod";

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, "Name must be at least 2 characters").max(100, "Name must be 100 characters or fewer"),
    email: z.string().trim().email("Email must be a valid email address").transform((value) => value.toLowerCase()),
    password: z.string().min(8, "Password must be at least 8 characters").max(128, "Password must be 128 characters or fewer"),
  })
  .strict();

export const loginSchema = z
  .object({
    email: z.string().trim().email("Email must be a valid email address").transform((value) => value.toLowerCase()),
    password: z.string().min(1, "Password is required").max(128, "Password must be 128 characters or fewer"),
  })
  .strict();

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
