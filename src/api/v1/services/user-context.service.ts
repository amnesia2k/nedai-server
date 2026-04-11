import { Weekday, type Documents, type TimetableActivity, type User } from "@prisma/client";

function appendLine(lines: string[], label: string, value: string | null | undefined) {
  const normalized = typeof value === "string" ? value.trim() : value;

  if (!normalized) {
    return;
  }

  lines.push(`${label}: ${normalized}`);
}

export function buildUserContextBlock(user: Pick<
  User,
  | "fullName"
  | "role"
  | "institution"
  | "matricNumber"
  | "studentAcademicLevel"
  | "dateOfBirth"
  | "lecturerHighestQualification"
  | "lecturerCurrentAcademicStage"
>) {
  const lines = ["Academic profile"];

  appendLine(lines, "Full name", user.fullName);
  appendLine(lines, "Role", user.role);
  appendLine(lines, "University name", user.institution);

  if (user.role === "STUDENT") {
    appendLine(lines, "Academic level", user.studentAcademicLevel);
    appendLine(lines, "Matric number", user.matricNumber);
    appendLine(
      lines,
      "Date of birth",
      user.dateOfBirth?.toISOString().slice(0, 10),
    );
  }

  if (user.role === "LECTURER") {
    appendLine(
      lines,
      "Highest qualification",
      user.lecturerHighestQualification,
    );
    appendLine(
      lines,
      "Current academic stage",
      user.lecturerCurrentAcademicStage,
    );
  }

  return lines.join("\n");
}

const weekdayLabels: Record<Weekday, string> = {
  MONDAY: "Monday",
  TUESDAY: "Tuesday",
  WEDNESDAY: "Wednesday",
  THURSDAY: "Thursday",
  FRIDAY: "Friday",
  SATURDAY: "Saturday",
  SUNDAY: "Sunday",
};

export function buildTimetableContextBlock(
  activities: Pick<TimetableActivity, "name" | "dayOfWeek" | "startTime" | "endTime">[],
) {
  if (activities.length === 0) {
    return "Weekly timetable\nNo timetable activities recorded.";
  }

  const lines = ["Weekly timetable"];

  for (const activity of activities) {
    lines.push(
      `${weekdayLabels[activity.dayOfWeek]} ${activity.startTime}-${activity.endTime}: ${activity.name}`,
    );
  }

  return lines.join("\n");
}

export function buildKnowledgeVaultContextBlock(
  documents: Pick<Documents, "title" | "sourceType">[],
) {
  if (documents.length === 0) {
    return "Knowledge vault\nNo uploaded documents are ready.";
  }

  return [
    "Knowledge vault",
    ...documents.map(
      (document, index) => `${index + 1}. ${document.title} (${document.sourceType})`,
    ),
  ].join("\n");
}
