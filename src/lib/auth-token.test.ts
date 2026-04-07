import { describe, expect, it } from "bun:test";
import { UserRole } from "@prisma/client";

import { ACCESS_TOKEN_TTL_SECONDS, buildAccessTokenPayload } from "@/lib/auth-token";

describe("buildAccessTokenPayload", () => {
  it("creates the expected access token payload shape", () => {
    const before = Math.floor(Date.now() / 1000);
    const payload = buildAccessTokenPayload({
      id: "user_123",
      email: "john@example.com",
      role: UserRole.STUDENT,
    });
    const after = Math.floor(Date.now() / 1000);

    expect(payload.sub).toBe("user_123");
    expect(payload.email).toBe("john@example.com");
    expect(payload.role).toBe(UserRole.STUDENT);
    expect(payload.type).toBe("access");
    expect(payload.exp).toBeGreaterThanOrEqual(before + ACCESS_TOKEN_TTL_SECONDS);
    expect(payload.exp).toBeLessThanOrEqual(after + ACCESS_TOKEN_TTL_SECONDS);
  });
});
