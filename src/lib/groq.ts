import Groq from "groq-sdk";

import { ApiError } from "@/lib/api-error";
import { env } from "@/utils/env";

let groqClient: Groq | null = null;

export function getGroqClient() {
  if (!env.GROQ_API_KEY) {
    throw new ApiError(500, "AI chat is not configured");
  }

  if (!groqClient) {
    groqClient = new Groq({
      apiKey: env.GROQ_API_KEY,
    });
  }

  return groqClient;
}
