import type { User } from "@prisma/client";

import { getProfileCompletion } from "@/utils/profile-completion.util";

export function serializeUser(user: User) {
  return {
    id: user.id,
    fullName: user.fullName,
    preferredName: user.preferredName,
    aboutMe: user.aboutMe,
    likes: user.likes,
    dislikes: user.dislikes,
    learningPreferences: Array.isArray(user.learningPreferences)
      ? user.learningPreferences
      : [],
    email: user.email,
    role: user.role,
    institution: user.institution,
    department: user.department,
    matricNumber: user.matricNumber,
    staffId: user.staffId,
    studentAcademicLevel: user.studentAcademicLevel,
    dateOfBirth: user.dateOfBirth?.toISOString().slice(0, 10) ?? null,
    lecturerHighestQualification: user.lecturerHighestQualification,
    lecturerCurrentAcademicStage: user.lecturerCurrentAcademicStage,
    profileCompletion: getProfileCompletion(user),
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}
