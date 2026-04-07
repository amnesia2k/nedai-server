import { describe, expect, it } from "bun:test";

import {
  changePasswordSchema,
  updateCurrentUserSchema,
} from "@/api/v1/app/schemas/user.schema";

describe("user schema validation", () => {
  it("accepts a valid profile patch with trimmed name", () => {
    const result = updateCurrentUserSchema.parse({
      name: "  John Doe  ",
    });

    expect(result).toEqual({
      name: "John Doe",
    });
  });

  it("rejects an empty profile patch body", () => {
    expect(() => updateCurrentUserSchema.parse({})).toThrow(
      "At least one field must be provided",
    );
  });

  it("rejects unknown profile fields", () => {
    expect(() =>
      updateCurrentUserSchema.parse({
        bio: "Hello",
      }),
    ).toThrow();
  });

  it("accepts a valid password change payload", () => {
    const result = changePasswordSchema.parse({
      oldPassword: "current-password",
      newPassword: "new-password-123",
    });

    expect(result).toEqual({
      oldPassword: "current-password",
      newPassword: "new-password-123",
    });
  });

  it("rejects unknown password fields", () => {
    expect(() =>
      changePasswordSchema.parse({
        oldPassword: "current-password",
        newPassword: "new-password-123",
        confirmPassword: "new-password-123",
      }),
    ).toThrow();
  });

  it("rejects short new passwords", () => {
    expect(() =>
      changePasswordSchema.parse({
        oldPassword: "current-password",
        newPassword: "short",
      }),
    ).toThrow("Password must be at least 8 characters");
  });

  it("rejects the same old and new password", () => {
    expect(() =>
      changePasswordSchema.parse({
        oldPassword: "same-password",
        newPassword: "same-password",
      }),
    ).toThrow("New password must be different from current password");
  });
});
