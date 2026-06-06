import { NextResponse } from "next/server";

import { startDemoSession } from "@/lib/demo-session";

export async function POST(request) {
  const formData = await request.formData();
  const nextPath =
    typeof formData.get("next") === "string" && formData.get("next").startsWith("/")
      ? formData.get("next")
      : "/";

  await startDemoSession();

  return NextResponse.redirect(new URL(nextPath, request.url), {
    status: 303
  });
}
