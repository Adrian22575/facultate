import { NextResponse } from "next/server";

import { startDemoSession } from "@/lib/demo-session";

function getSafeNextPath(value, fallback = "/") {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//")
    ? value
    : fallback;
}

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const nextPath = getSafeNextPath(requestUrl.searchParams.get("next"), "/demo");

  await startDemoSession();

  return NextResponse.redirect(new URL(nextPath, request.url), {
    status: 303
  });
}

export async function POST(request) {
  const formData = await request.formData();
  const nextPath = getSafeNextPath(formData.get("next"));

  await startDemoSession();

  return NextResponse.redirect(new URL(nextPath, request.url), {
    status: 303
  });
}
