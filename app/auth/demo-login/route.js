import { NextResponse } from "next/server";

import { getPostLoginNextPath } from "@/lib/auth/password-auth";
import { startDemoSession } from "@/lib/demo-session";

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const requestedNextPath = requestUrl.searchParams.get("next");
  const nextPath = requestedNextPath ? getPostLoginNextPath(requestedNextPath) : "/demo";

  await startDemoSession();

  return NextResponse.redirect(new URL(nextPath, request.url), {
    status: 303
  });
}

export async function POST(request) {
  const formData = await request.formData();
  const nextPath = getPostLoginNextPath(formData.get("next"));

  await startDemoSession();

  return NextResponse.redirect(new URL(nextPath, request.url), {
    status: 303
  });
}
