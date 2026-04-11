import { beforeEach, describe, expect, it, mock } from "bun:test";
import { UserRole } from "@prisma/client";

import { AuthServiceImpl } from "@/api/v1/services/auth.service";

function createUser(overrides: Partial<any> = {}) {
  return {
    id: "user-1",
    email: "user@example.com",
    passwordHash: "hashed-current-password",
    fullName: "John Doe",
    preferredName: null,
    aboutMe: null,
    likes: [],
    dislikes: [],
    learningPreferences: null,
    role: UserRole.STUDENT,
    institution: null,
    department: null,
    matricNumber: null,
    staffId: null,
    studentAcademicLevel: null,
    dateOfBirth: null,
    lecturerHighestQualification: null,
    lecturerCurrentAcademicStage: null,
    createdAt: new Date("2026-04-07T08:00:00.000Z"),
    updatedAt: new Date("2026-04-07T08:00:00.000Z"),
    ...overrides,
  };
}

function createPrismaMock() {
  return {
    user: {
      create: mock(async () => createUser()),
      findUnique: mock(async () => createUser()),
      update: mock(async () => createUser()),
    },
  };
}

describe("AuthServiceImpl", () => {
  const originalBunPassword = Bun.password;

  beforeEach(() => {
    (Bun as any).password = {
      ...originalBunPassword,
      hash: mock(async () => "hashed-new-password"),
      verify: mock(async () => true),
    };
  });

  it("updates student profile fields and returns completion metadata", async () => {
    const prisma = createPrismaMock();
    const updatedUser = createUser({
      fullName: "Jane Doe",
      institution: "NedAI University",
      matricNumber: "MAT-100",
      studentAcademicLevel: "400 Level",
      dateOfBirth: new Date("2000-10-12T00:00:00.000Z"),
      updatedAt: new Date("2026-04-07T08:05:00.000Z"),
    });
    (prisma.user.findUnique as any).mockResolvedValueOnce(createUser());
    (prisma.user.update as any).mockResolvedValueOnce(updatedUser);

    const service = new AuthServiceImpl(prisma as never);
    const result = await service.updateCurrentUser("user-1", {
      fullName: "  Jane Doe  ",
      institution: "  NedAI University ",
      matricNumber: " MAT-100 ",
      studentAcademicLevel: " 400 Level ",
      dateOfBirth: "2000-10-12",
    });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: {
        id: "user-1",
      },
      data: {
        fullName: "Jane Doe",
        institution: "NedAI University",
        matricNumber: "MAT-100",
        studentAcademicLevel: "400 Level",
        dateOfBirth: new Date("2000-10-12T00:00:00.000Z"),
      },
    });
    expect(result.profileCompletion).toEqual({
      isComplete: true,
      missingFields: [],
    });
  });

  it("allows lecturer-only null fields for students", async () => {
    const prisma = createPrismaMock();
    const updatedUser = createUser({
      fullName: "Jane Doe",
      institution: "NedAI University",
      matricNumber: "MAT-100",
      studentAcademicLevel: "400 Level",
      dateOfBirth: new Date("2000-10-12T00:00:00.000Z"),
      lecturerHighestQualification: null,
      lecturerCurrentAcademicStage: null,
      updatedAt: new Date("2026-04-07T08:05:00.000Z"),
    });
    (prisma.user.findUnique as any).mockResolvedValueOnce(createUser());
    (prisma.user.update as any).mockResolvedValueOnce(updatedUser);

    const service = new AuthServiceImpl(prisma as never);

    await service.updateCurrentUser("user-1", {
      fullName: "Jane Doe",
      institution: "NedAI University",
      matricNumber: "MAT-100",
      studentAcademicLevel: "400 Level",
      dateOfBirth: "2000-10-12",
      lecturerHighestQualification: null,
      lecturerCurrentAcademicStage: null,
    });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: {
        id: "user-1",
      },
      data: {
        fullName: "Jane Doe",
        institution: "NedAI University",
        matricNumber: "MAT-100",
        studentAcademicLevel: "400 Level",
        dateOfBirth: new Date("2000-10-12T00:00:00.000Z"),
        lecturerHighestQualification: null,
        lecturerCurrentAcademicStage: null,
      },
    });
  });

  it("returns 401 if the current user does not exist during profile update", async () => {
    const prisma = createPrismaMock();
    (prisma.user.findUnique as any).mockResolvedValueOnce(null);

    const service = new AuthServiceImpl(prisma as never);

    await expect(
      service.updateCurrentUser("missing-user", {
        fullName: "Jane Doe",
      }),
    ).rejects.toMatchObject({
      statusCode: 401,
      message: "Unauthorized",
    });
  });

  it("rejects lecturer-only fields for students", async () => {
    const prisma = createPrismaMock();
    (prisma.user.findUnique as any).mockResolvedValueOnce(createUser());

    const service = new AuthServiceImpl(prisma as never);

    await expect(
      service.updateCurrentUser("user-1", {
        lecturerHighestQualification: "BSc Computer Science",
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Lecturer profile fields are only valid for lecturers",
    });
  });

  it("allows student-only null fields for lecturers", async () => {
    const prisma = createPrismaMock();
    const updatedUser = createUser({
      role: UserRole.LECTURER,
      institution: "NedAI University",
      matricNumber: null,
      studentAcademicLevel: null,
      dateOfBirth: null,
      lecturerHighestQualification: "BSc Computer Science",
      lecturerCurrentAcademicStage: "PhD",
      updatedAt: new Date("2026-04-07T08:05:00.000Z"),
    });
    (prisma.user.findUnique as any).mockResolvedValueOnce(
      createUser({ role: UserRole.LECTURER }),
    );
    (prisma.user.update as any).mockResolvedValueOnce(updatedUser);

    const service = new AuthServiceImpl(prisma as never);

    await service.updateCurrentUser("user-1", {
      institution: "NedAI University",
      matricNumber: null,
      studentAcademicLevel: null,
      dateOfBirth: null,
      lecturerHighestQualification: "BSc Computer Science",
      lecturerCurrentAcademicStage: "PhD",
    });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: {
        id: "user-1",
      },
      data: {
        institution: "NedAI University",
        matricNumber: null,
        studentAcademicLevel: null,
        dateOfBirth: null,
        lecturerHighestQualification: "BSc Computer Science",
        lecturerCurrentAcademicStage: "PhD",
      },
    });
  });

  it("rejects student-only fields for lecturers when they contain values", async () => {
    const prisma = createPrismaMock();
    (prisma.user.findUnique as any).mockResolvedValueOnce(
      createUser({ role: UserRole.LECTURER }),
    );

    const service = new AuthServiceImpl(prisma as never);

    await expect(
      service.updateCurrentUser("user-1", {
        matricNumber: "STALE-STUDENT-ID",
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Matric number is only valid for students",
    });
  });

  it("rejects an incorrect current password", async () => {
    const prisma = createPrismaMock();
    (prisma.user.findUnique as any).mockResolvedValueOnce(createUser());
    (Bun.password.verify as any).mockResolvedValueOnce(false);

    const service = new AuthServiceImpl(prisma as never);

    await expect(
      service.changeCurrentPassword("user-1", {
        oldPassword: "wrong-password",
        newPassword: "new-password-123",
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Current password is incorrect",
    });
  });

  it("hashes and stores the new password", async () => {
    const prisma = createPrismaMock();
    (prisma.user.findUnique as any).mockResolvedValueOnce(createUser());

    const service = new AuthServiceImpl(prisma as never);

    await service.changeCurrentPassword("user-1", {
      oldPassword: "current-password",
      newPassword: "new-password-123",
    });

    expect(Bun.password.verify).toHaveBeenCalledWith(
      "current-password",
      "hashed-current-password",
    );
    expect(Bun.password.hash).toHaveBeenCalledWith("new-password-123");
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: {
        id: "user-1",
      },
      data: {
        passwordHash: "hashed-new-password",
      },
    });
  });
});
