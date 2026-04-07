import { beforeEach, describe, expect, it, mock } from "bun:test";
import { UserRole } from "@prisma/client";

import { AuthServiceImpl } from "@/api/v1/services/auth.service";

function createUser(overrides: Partial<any> = {}) {
  return {
    id: "user-1",
    email: "user@example.com",
    passwordHash: "hashed-current-password",
    fullName: "John Doe",
    role: UserRole.STUDENT,
    institution: null,
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
    Bun.password = {
      ...originalBunPassword,
      hash: mock(async () => "hashed-new-password"),
      verify: mock(async () => true),
    };
  });

  it("updates fullName and returns the serialized user", async () => {
    const prisma = createPrismaMock();
    const updatedUser = createUser({
      fullName: "Jane Doe",
      updatedAt: new Date("2026-04-07T08:05:00.000Z"),
    });
    (prisma.user.findUnique as any).mockResolvedValueOnce(createUser());
    (prisma.user.update as any).mockResolvedValueOnce(updatedUser);

    const service = new AuthServiceImpl(prisma as never);
    const result = await service.updateCurrentUser("user-1", {
      name: "  Jane Doe  ",
    });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: {
        id: "user-1",
      },
      data: {
        fullName: "Jane Doe",
      },
    });
    expect(result).toEqual({
      id: "user-1",
      name: "Jane Doe",
      email: "user@example.com",
      role: UserRole.STUDENT,
      institution: null,
      createdAt: "2026-04-07T08:00:00.000Z",
      updatedAt: "2026-04-07T08:05:00.000Z",
    });
  });

  it("returns 401 if the current user does not exist during profile update", async () => {
    const prisma = createPrismaMock();
    (prisma.user.findUnique as any).mockResolvedValueOnce(null);

    const service = new AuthServiceImpl(prisma as never);

    await expect(
      service.updateCurrentUser("missing-user", {
        name: "Jane Doe",
      }),
    ).rejects.toMatchObject({
      statusCode: 401,
      message: "Unauthorized",
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

  it("does not expose passwordHash when updating the password", async () => {
    const prisma = createPrismaMock();
    (prisma.user.findUnique as any).mockResolvedValueOnce(createUser());

    const service = new AuthServiceImpl(prisma as never);
    const result = await service.changeCurrentPassword("user-1", {
      oldPassword: "current-password",
      newPassword: "new-password-123",
    });

    expect(result).toBeUndefined();
  });
});
