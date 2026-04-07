import type { User } from "@prisma/client";

export function serializeUser(user: User) {
  return {
    id: user.id,
    name: user.fullName,
    email: user.email,
    role: user.role,
    institution: user.institution,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}
