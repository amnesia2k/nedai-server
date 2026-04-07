import { describe, expect, it } from "bun:test";

import { loginSchema, registerSchema } from "@/api/v1/app/schemas/auth.schema";

describe("auth schema validation", () => {
  it("normalizes valid register input", () => {
    const result = registerSchema.parse({
      name: "  John Doe  ",
      email: "  JOHN@EXAMPLE.COM  ",
      password: "secret123",
    });

    expect(result).toEqual({
      name: "John Doe",
      email: "john@example.com",
      password: "secret123",
    });
  });

  it("rejects unknown register fields", () => {
    expect(() =>
      registerSchema.parse({
        name: "John Doe",
        email: "john@example.com",
        password: "secret123",
        role: "LECTURER",
      }),
    ).toThrow();
  });

  it("normalizes valid login input", () => {
    const result = loginSchema.parse({
      email: "  JOHN@EXAMPLE.COM  ",
      password: "secret123",
    });

    expect(result).toEqual({
      email: "john@example.com",
      password: "secret123",
    });
  });
});
