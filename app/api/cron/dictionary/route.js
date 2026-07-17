import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { runDictionaryGeneration } from "@/lib/dictionary/automation";
import { runEditorialGeneration } from "@/lib/editorial/automation";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

function hasValidCronAuthorization(request) {
  const secret = String(process.env.CRON_SECRET || "");
  const authorization = String(request.headers.get("authorization") || "");
  const expected = `Bearer ${secret}`;
  return secret.length >= 24 && authorization.length === expected.length && timingSafeEqual(Buffer.from(authorization), Buffer.from(expected));
}

export async function GET(request) {
  if (!hasValidCronAuthorization(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const [dictionary, editorial] = await Promise.all([
      runDictionaryGeneration({ triggerSource: "cron" }),
      runEditorialGeneration({ triggerSource: "cron" })
    ]);
    const ok = dictionary.ok && editorial.ok;
    return NextResponse.json({ ok, dictionary, editorial }, { status: ok ? 200 : 422 });
  } catch (error) {
    console.error("dictionary_cron_failed", { message: error instanceof Error ? error.message : "unknown_error" });
    return NextResponse.json({ ok: false, error: "dictionary_generation_failed" }, { status: 500 });
  }
}
