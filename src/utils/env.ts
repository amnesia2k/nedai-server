import "dotenv/config";

function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getNumberEnv(name: string, fallback: number): number {
  const value = process.env[name];

  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(`Environment variable ${name} must be a valid number`);
  }

  return parsed;
}

export const env = {
  DATABASE_URL: process.env.DATABASE_URL,
  GROQ_API_KEY: process.env.GROQ_API_KEY,
  GROQ_CHAT_MODEL: process.env.GROQ_CHAT_MODEL || "openai/gpt-oss-20b",
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  UPLOADTHING_TOKEN: process.env.UPLOADTHING_TOKEN,
  JWT_SECRET: getRequiredEnv("JWT_SECRET"),
  CHAT_RETRIEVAL_TOP_K: Math.max(
    1,
    Math.floor(getNumberEnv("CHAT_RETRIEVAL_TOP_K", 5)),
  ),
  CHAT_RETRIEVAL_MIN_SCORE: getNumberEnv("CHAT_RETRIEVAL_MIN_SCORE", 0.5),
  CHAT_HISTORY_LIMIT: Math.max(
    1,
    Math.floor(getNumberEnv("CHAT_HISTORY_LIMIT", 10)),
  ),
  EMBEDDING_PROVIDER: (process.env.EMBEDDING_PROVIDER || "local") as
    | "local"
    | "openai",
} as const;
