import fs from "node:fs/promises";
import path from "node:path";

function sanitizeFilename(filename: string) {
  const normalized = filename.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
  return normalized.replace(/^-+|-+$/g, "") || "document";
}

export class DocumentStorageService {
  private readonly rootPath: string;

  constructor(rootPath = path.resolve(process.cwd(), "uploads")) {
    this.rootPath = rootPath;
  }

  public async writeUserUpload(options: {
    userId: string;
    originalFilename: string;
    buffer: Buffer;
  }) {
    const userDirectory = path.join(this.rootPath, options.userId);
    await fs.mkdir(userDirectory, { recursive: true });

    const filename = `${crypto.randomUUID()}-${sanitizeFilename(
      options.originalFilename,
    )}`;
    const absolutePath = path.join(userDirectory, filename);
    const relativePath = path
      .relative(this.rootPath, absolutePath)
      .replace(/\\/g, "/");

    await fs.writeFile(absolutePath, options.buffer);

    return {
      absolutePath,
      storagePath: relativePath,
      byteSize: options.buffer.byteLength,
    };
  }

  public resolveAbsolutePath(storagePath: string) {
    return path.join(this.rootPath, storagePath);
  }

  public async deleteStoredFile(storagePath: string) {
    try {
      await fs.unlink(this.resolveAbsolutePath(storagePath));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }
}

const DocumentStorage = new DocumentStorageService();

export default DocumentStorage;
