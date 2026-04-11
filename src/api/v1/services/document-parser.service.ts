import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { DocumentOrigin, SourceType } from "@prisma/client";

import { ApiError } from "@/lib/api-error";
import { sanitizeExtractedText } from "@/utils/knowledge-source.util";
import { isRemoteFileUrl } from "@/uploadthing/utils";

const execFileAsync = promisify(execFile);
const DOC_UPLOAD_ERROR =
  ".doc uploads require LibreOffice headless support on the server";

export class DocumentParserService {
  private legacyDocSupport: boolean | null = null;

  public getSourceType(filename: string) {
    const extension = path.extname(filename).toLowerCase();

    if (extension === ".docx") {
      return SourceType.DOCX;
    }

    if (extension === ".doc") {
      return SourceType.DOC;
    }

    if (extension === ".pdf") {
      return SourceType.PDF;
    }

    throw new ApiError(415, "Only .pdf, .docx and .doc files are supported");
  }

  public async assertUploadSupported(sourceType: SourceType) {
    if (sourceType === SourceType.DOC && !(await this.hasLegacyDocSupport())) {
      throw new ApiError(503, DOC_UPLOAD_ERROR);
    }
  }

  public async extractTextFromDocument(
    absolutePath: string,
    sourceType: SourceType,
  ) {
    if (sourceType === SourceType.DOCX) {
      const result = await mammoth.extractRawText({ path: absolutePath });
      return sanitizeExtractedText(result.value);
    }

    if (sourceType === SourceType.DOC) {
      const convertedPath = await this.convertDocToDocx(absolutePath);

      try {
        const result = await mammoth.extractRawText({ path: convertedPath });
        return sanitizeExtractedText(result.value);
      } finally {
        await fs.rm(path.dirname(convertedPath), {
          recursive: true,
          force: true,
        });
      }
    }

    if (sourceType === SourceType.PDF) {
      const buffer = await fs.readFile(absolutePath);
      const parser = new PDFParse({ data: buffer });

      try {
        const result = await parser.getText();
        return sanitizeExtractedText(result.text);
      } finally {
        await parser.destroy();
      }
    }

    throw new ApiError(415, "Unsupported document type");
  }

  public async extractTextFromLocation(
    location: string,
    sourceType: SourceType,
    origin: DocumentOrigin,
  ) {
    if (origin === DocumentOrigin.USER_UPLOAD && isRemoteFileUrl(location)) {
      const fileBuffer = await this.downloadRemoteFile(location);
      return this.extractTextFromBuffer(fileBuffer, sourceType);
    }

    return this.extractTextFromDocument(location, sourceType);
  }

  public async hasLegacyDocSupport() {
    if (this.legacyDocSupport !== null) {
      return this.legacyDocSupport;
    }

    try {
      const result = Bun.spawnSync({
        cmd: ["soffice", "--version"],
        stdout: "ignore",
        stderr: "ignore",
      });

      this.legacyDocSupport = result.exitCode === 0;
    } catch {
      this.legacyDocSupport = false;
    }

    return this.legacyDocSupport;
  }

  private async convertDocToDocx(absolutePath: string) {
    if (!(await this.hasLegacyDocSupport())) {
      throw new Error(DOC_UPLOAD_ERROR);
    }

    const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "nedai-doc-"));

    await execFileAsync("soffice", [
      "--headless",
      "--convert-to",
      "docx",
      "--outdir",
      tempDirectory,
      absolutePath,
    ]);

    const convertedPath = path.join(
      tempDirectory,
      `${path.parse(absolutePath).name}.docx`,
    );

    await fs.access(convertedPath);
    return convertedPath;
  }

  private async extractTextFromBuffer(
    buffer: Buffer,
    sourceType: SourceType,
  ): Promise<string> {
    if (sourceType === SourceType.DOCX) {
      const result = await mammoth.extractRawText({ buffer });
      return sanitizeExtractedText(result.value);
    }

    if (sourceType === SourceType.DOC) {
      const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "nedai-doc-"));
      const absolutePath = path.join(tempDirectory, `upload-${crypto.randomUUID()}.doc`);

      try {
        await fs.writeFile(absolutePath, buffer);
        const convertedPath = await this.convertDocToDocx(absolutePath);
        const result = await mammoth.extractRawText({ path: convertedPath });
        return sanitizeExtractedText(result.value);
      } finally {
        await fs.rm(tempDirectory, {
          recursive: true,
          force: true,
        });
      }
    }

    if (sourceType === SourceType.PDF) {
      const parser = new PDFParse({ data: buffer });

      try {
        const result = await parser.getText();
        return sanitizeExtractedText(result.text);
      } finally {
        await parser.destroy();
      }
    }

    throw new ApiError(415, "Unsupported document type");
  }

  private async downloadRemoteFile(fileUrl: string) {
    const response = await fetch(fileUrl);

    if (!response.ok) {
      throw new Error(`Failed to download document (${response.status})`);
    }

    return Buffer.from(await response.arrayBuffer());
  }
}

const DocumentParser = new DocumentParserService();

export default DocumentParser;
