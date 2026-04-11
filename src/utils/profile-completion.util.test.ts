import { describe, expect, it } from "bun:test";
import { UserRole } from "@prisma/client";

import { getProfileCompletion } from "@/utils/profile-completion.util";

describe("profile completion", () => {
  it("marks student profiles incomplete when required fields are missing", () => {
    expect(
      getProfileCompletion({
        role: UserRole.STUDENT,
        fullName: "Jane Doe",
        institution: "NedAI University",
        matricNumber: null,
        studentAcademicLevel: null,
        dateOfBirth: null,
        lecturerHighestQualification: null,
        lecturerCurrentAcademicStage: null,
      }),
    ).toEqual({
      isComplete: false,
      missingFields: [
        "studentAcademicLevel",
        "matricNumber",
        "dateOfBirth",
      ],
    });
  });

  it("marks lecturer profiles complete when all role fields are present", () => {
    expect(
      getProfileCompletion({
        role: UserRole.LECTURER,
        fullName: "Dr Ada",
        institution: "NedAI University",
        matricNumber: null,
        studentAcademicLevel: null,
        dateOfBirth: null,
        lecturerHighestQualification: "BSc Computer Science",
        lecturerCurrentAcademicStage: "PhD",
      }),
    ).toEqual({
      isComplete: true,
      missingFields: [],
    });
  });
});
