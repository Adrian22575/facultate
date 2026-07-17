import { NextResponse } from "next/server";

import { isAdminUser } from "@/lib/admin";
import { runEditorialGeneration } from "@/lib/editorial/automation";
import { createClient } from "@/lib/supabase/server";

async function requireApiAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user && await isAdminUser(user) ? user : null;
}

export async function POST() {
  const user = await requireApiAdmin();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const result = await runEditorialGeneration({ triggerSource: "admin", runKey: `admin:${user.id}:${crypto.randomUUID()}`, publish: false, force: true });
    return NextResponse.json(result, { status: result.ok ? 200 : 422 });
  } catch (error) {
    console.error("admin_editorial_generation_failed", { message: error instanceof Error ? error.message : "unknown_error" });
    return NextResponse.json({ error: "generation_failed" }, { status: 500 });
  }
}
