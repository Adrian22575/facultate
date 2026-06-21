import { NextResponse } from "next/server";

import { getPostLoginNextPath } from "@/lib/auth/password-auth";
import { clearDemoSession } from "@/lib/demo-session";

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const nextPath = getPostLoginNextPath(requestUrl.searchParams.get("next"));

  await clearDemoSession();

  return NextResponse.redirect(new URL(nextPath, request.url), {
    status: 303
  });
}
