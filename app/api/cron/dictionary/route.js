import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { runDictionaryGeneration } from "@/lib/dictionary/automation";
import { runEditorialGeneration } from "@/lib/editorial/automation";
import { synchronizeEditorialSchedulerSecret } from "@/lib/editorial/scheduler";

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
    await synchronizeEditorialSchedulerSecret();
    const now = new Date();
    const [dictionary, editorial] = await Promise.all([
      runDictionaryGeneration({ triggerSource: "cron", now }),
      runEditorialGeneration({ triggerSource: "cron", date: now })
    ]);
    const ok = dictionary.ok && editorial.ok;
    console.info("dictionary_cron_completed", {
      invokedAt: now.toISOString(),
      dictionary: { ok: dictionary.ok, skipped: Boolean(dictionary.skipped), reason: dictionary.reason || null, termId: dictionary.term?.id || null, notificationSent: Boolean(dictionary.notificationSent) },
      editorial: { ok: editorial.ok, skipped: Boolean(editorial.skipped), reason: editorial.reason || null, articleId: editorial.article?.id || null, notificationSent: Boolean(editorial.notificationSent) }
    });
    return NextResponse.json({ ok, dictionary, editorial }, { status: ok ? 200 : 422 });
  } catch (error) {
    console.error("dictionary_cron_failed", { message: error instanceof Error ? error.message : "unknown_error" });
    return NextResponse.json({ ok: false, error: "dictionary_generation_failed" }, { status: 500 });
  }
}
