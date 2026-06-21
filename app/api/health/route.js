import { NextResponse } from "next/server";

import { checkApplicationHealth } from "@/lib/health";

export const dynamic = "force-dynamic";

function getReleaseId() {
  return String(process.env.VERCEL_GIT_COMMIT_SHA || "")
    .trim()
    .slice(0, 12) || "local";
}

function response(status, statusCode) {
  return NextResponse.json(
    { status, release: getReleaseId() },
    {
      status: statusCode,
      headers: {
        "Cache-Control": "no-store, max-age=0"
      }
    }
  );
}

export async function GET() {
  const health = await checkApplicationHealth();
  if (health.ok) return response("ok", 200);

  console.error("health_database_check_failed", { code: health.code });
  return response("unavailable", 503);
}
