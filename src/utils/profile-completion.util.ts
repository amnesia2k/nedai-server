import { UserRole, type User } from "@prisma/client";

export type ProfileCompletion = {
  isComplete: boolean;
  missingFields: string[];
};

function hasValue(value: string | Date | null | undefined) {
  if (value instanceof Date) {
    return !Number.isNaN(value.getTime());
  }

  return typeof value === "string" ? value.trim().length > 0 : Boolean(value);
}

export function getProfileCompletion(
  user: Pick<
    User,
    | "role"
    | "fullName"
    | "institution"
    | "matricNumber"
    | "studentAcademicLevel"
    | "dateOfBirth"
    | "lecturerHighestQualification"
    | "lecturerCurrentAcademicStage"
  >,
): ProfileCompletion {
  const missingFields: string[] = [];

  if (!hasValue(user.fullName)) {
    missingFields.push("fullName");
  }

  if (!hasValue(user.institution)) {
    missingFields.push("institution");
  }

  if (user.role === UserRole.STUDENT) {
    if (!hasValue(user.studentAcademicLevel)) {
      missingFields.push("studentAcademicLevel");
    }

    if (!hasValue(user.matricNumber)) {
      missingFields.push("matricNumber");
    }

    if (!hasValue(user.dateOfBirth)) {
      missingFields.push("dateOfBirth");
    }
  }

  if (user.role === UserRole.LECTURER) {
    if (!hasValue(user.lecturerHighestQualification)) {
      missingFields.push("lecturerHighestQualification");
    }

    if (!hasValue(user.lecturerCurrentAcademicStage)) {
      missingFields.push("lecturerCurrentAcademicStage");
    }
  }

  return {
    isComplete: missingFields.length === 0,
    missingFields,
  };
}
