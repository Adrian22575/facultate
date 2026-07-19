import { NextResponse } from "next/server";

import { isAdminUser } from "@/lib/admin";
import { searchDictionaryAdminTerms } from "@/lib/dictionary/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdminUser(user))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const query = new URL(request.url).searchParams.get("q") || "";
  if (query.trim().length < 2) return NextResponse.json({ terms: [] });

  try {
    return NextResponse.json({ terms: await searchDictionaryAdminTerms(query) });
  } catch (error) {
    console.error("admin_dictionary_search_failed", { message: error instanceof Error ? error.message : "unknown_error" });
    return NextResponse.json({ error: "search_failed" }, { status: 500 });
  }
}
