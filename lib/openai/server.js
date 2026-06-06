import "server-only";

import OpenAI from "openai";

import { getSupabaseServerEnv, hasOpenAIEnv } from "@/lib/env/server";

let openaiClient;

export function hasOpenAIKey() {
  return hasOpenAIEnv();
}

export function getOpenAI() {
  if (!hasOpenAIEnv()) {
    throw new Error(
      "Procesarea nu este configurata. Completeaza cheia privata doar pe server."
    );
  }

  if (!openaiClient) {
    const { OPENAI_API_KEY } = getSupabaseServerEnv();
    openaiClient = new OpenAI({
      apiKey: OPENAI_API_KEY
    });
  }

  return openaiClient;
}
