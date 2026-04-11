import { z } from "zod";
import { createUploadthing, type FileRouter } from "uploadthing/server";

import { ApiError } from "@/lib/api-error";
import DocumentParser from "@/api/v1/services/document-parser.service";
import {
  MAX_FILE_BYTES,
} from "@/api/v1/services/document.constants";
import DocumentService from "@/api/v1/services/document.service";
import { deleteUploadThingFileByKey } from "@/uploadthing/utapi";
import {
  toUploadThingError,
  verifyUploadThingRequest,
} from "@/uploadthing/utils";

const f = createUploadthing();

const documentUploadInputSchema = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
  })
  .nullish()
  .transform((value) => value ?? {});

export const uploadRouter = {
  documentUploader: f(
    {
      pdf: {
        maxFileSize: "8MB",
        maxFileCount: 1,
      },
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        {
          maxFileSize: "8MB",
          maxFileCount: 1,
        },
      "application/msword": {
        maxFileSize: "8MB",
        maxFileCount: 1,
      },
    },
    {
      awaitServerData: true,
    },
  )
    .input(documentUploadInputSchema)
    .middleware(async ({ req, files, input }) => {
      try {
        const payload = await verifyUploadThingRequest(req);
        const candidateFile = files[0];

        if (!candidateFile) {
          throw new ApiError(400, "A file upload is required");
        }

        if (candidateFile.size > MAX_FILE_BYTES) {
          throw new ApiError(413, "The file exceeds the 5 MB upload limit");
        }

        const sourceType = DocumentParser.getSourceType(candidateFile.name);
        await DocumentParser.assertUploadSupported(sourceType);

        const quota = await DocumentService.getQuota(payload.sub);

        if (quota.usedDocuments >= quota.maxDocuments) {
          throw new ApiError(409, "You have reached the 10 document limit");
        }

        if (quota.usedBytes + candidateFile.size > quota.maxBytes) {
          throw new ApiError(
            409,
            "This upload would exceed your total storage quota",
          );
        }

        return {
          userId: payload.sub,
          title: input.title?.trim() || undefined,
        };
      } catch (error) {
        throw toUploadThingError(error);
      }
    })
    .onUploadError(({ error, fileKey }) => {
      console.error("[uploadthing] document upload failed", {
        fileKey,
        error,
      });
    })
    .onUploadComplete(async ({ metadata, file }) => {
      try {
        const document = await DocumentService.createDocumentFromUpload({
          userId: metadata.userId,
          file,
          title: metadata.title,
        });

        return {
          documentId: document.id,
          status: document.status,
          url: file.ufsUrl,
        };
      } catch (error) {
        await deleteUploadThingFileByKey(file.key);
        throw toUploadThingError(error);
      }
    }),
} satisfies FileRouter;

export type UploadRouter = typeof uploadRouter;
