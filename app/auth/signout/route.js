import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { clearDemoSession } from "@/lib/demo-session";
import { hasSupabasePublicEnv } from "@/lib/env/public";
import { createClient } from "@/lib/supabase/server";

export async function POST(request) {
  await clearDemoSession();

  if (hasSupabasePublicEnv()) {
    const supabase = await createClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (user) {
      await supabase.auth.signOut();
    }
  }

  revalidatePath("/", "layout");
  revalidatePath("/cont", "layout");

  return NextResponse.redirect(new URL("/", request.url), {
    status: 302
  });
}
