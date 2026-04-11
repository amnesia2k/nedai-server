import { UTApi } from "uploadthing/server";

import { env } from "@/utils/env";
import { getUploadThingFileKey } from "@/uploadthing/utils";

export const utapi = new UTApi(
  env.UPLOADTHING_TOKEN ? { token: env.UPLOADTHING_TOKEN } : undefined,
);

export async function deleteUploadThingFileByKey(
  fileKey: string | null | undefined,
) {
  if (!fileKey) {
    return;
  }

  try {
    await utapi.deleteFiles(fileKey);
  } catch (error) {
    console.error("[uploadthing] failed to delete file", {
      fileKey,
      error,
    });
  }
}

export async function deleteUploadThingFileByUrl(fileUrl: string) {
  await deleteUploadThingFileByKey(getUploadThingFileKey(fileUrl));
}
