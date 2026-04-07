import { describe, expect, it } from "bun:test";
import { UserRole, type User } from "@prisma/client";

import { serializeUser } from "@/api/v1/serializers/user.serializer";

describe("serializeUser", () => {
  it("maps fullName to name and omits passwordHash", () => {
    const now = new Date("2026-04-06T10:00:00.000Z");
    const user = {
      id: "user_123",
      email: "john@example.com",
      passwordHash: "hashed",
      fullName: "John Doe",
      role: UserRole.STUDENT,
      institution: null,
      createdAt: now,
      updatedAt: now,
    } satisfies User;

    expect(serializeUser(user)).toEqual({
      id: "user_123",
      name: "John Doe",
      email: "john@example.com",
      role: UserRole.STUDENT,
      institution: null,
      createdAt: "2026-04-06T10:00:00.000Z",
      updatedAt: "2026-04-06T10:00:00.000Z",
    });
  });
});
