import { NextResponse } from "next/server";

import { clearDemoSession } from "@/lib/demo-session";

function getSafeNextPath(value, fallback = "/") {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//")
    ? value
    : fallback;
}

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const nextPath = getSafeNextPath(requestUrl.searchParams.get("next"));

  await clearDemoSession();

  return NextResponse.redirect(new URL(nextPath, request.url), {
    status: 303
  });
}
