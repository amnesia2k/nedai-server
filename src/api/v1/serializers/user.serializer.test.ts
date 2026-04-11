import { describe, expect, it } from "bun:test";
import { UserRole, type User } from "@prisma/client";

import { serializeUser } from "@/api/v1/serializers/user.serializer";

describe("serializeUser", () => {
  it("serializes user profile fields and completion state", () => {
    const now = new Date("2026-04-06T10:00:00.000Z");
    const user = {
      id: "user_123",
      email: "john@example.com",
      passwordHash: "hashed",
      fullName: "John Doe",
      preferredName: null,
      aboutMe: null,
      likes: [],
      dislikes: [],
      learningPreferences: null,
      role: UserRole.STUDENT,
      institution: "NedAI University",
      department: null,
      matricNumber: "MAT-001",
      staffId: null,
      studentAcademicLevel: "400 Level",
      dateOfBirth: new Date("2000-10-12T00:00:00.000Z"),
      lecturerHighestQualification: null,
      lecturerCurrentAcademicStage: null,
      createdAt: now,
      updatedAt: now,
    } satisfies User;

    expect(serializeUser(user)).toEqual({
      id: "user_123",
      fullName: "John Doe",
      preferredName: null,
      aboutMe: null,
      likes: [],
      dislikes: [],
      learningPreferences: [],
      email: "john@example.com",
      role: UserRole.STUDENT,
      institution: "NedAI University",
      department: null,
      matricNumber: "MAT-001",
      staffId: null,
      studentAcademicLevel: "400 Level",
      dateOfBirth: "2000-10-12",
      lecturerHighestQualification: null,
      lecturerCurrentAcademicStage: null,
      profileCompletion: {
        isComplete: true,
        missingFields: [],
      },
      createdAt: "2026-04-06T10:00:00.000Z",
      updatedAt: "2026-04-06T10:00:00.000Z",
    });
  });
});
