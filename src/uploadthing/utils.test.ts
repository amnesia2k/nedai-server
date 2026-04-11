import { describe, expect, it } from "bun:test";
import { UserRole } from "@prisma/client";

import { issueAccessToken } from "@/lib/auth-token";
import {
  getUploadThingFileKey,
  verifyUploadThingRequest,
} from "@/uploadthing/utils";

describe("uploadthing utils", () => {
  it("rejects requests without a bearer token", async () => {
    const request = new Request("https://example.com/api/uploadthing");

    await expect(verifyUploadThingRequest(request)).rejects.toMatchObject({
      message: "Unauthorized",
    });
  });

  it("verifies bearer tokens from uploadthing requests", async () => {
    const token = await issueAccessToken({
      id: "user-1",
      email: "user@example.com",
      role: UserRole.STUDENT,
    });
    const request = new Request("https://example.com/api/uploadthing", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    await expect(verifyUploadThingRequest(request)).resolves.toMatchObject({
      sub: "user-1",
      email: "user@example.com",
      role: UserRole.STUDENT,
      type: "access",
    });
  });

  it("extracts uploadthing file keys from CDN URLs", () => {
    expect(
      getUploadThingFileKey("https://app_123.ufs.sh/f/file_abc123"),
    ).toBe("file_abc123");
    expect(getUploadThingFileKey("uploads/user-1/chemistry.pdf")).toBeNull();
  });
});
