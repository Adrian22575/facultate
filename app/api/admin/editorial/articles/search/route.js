import { NextResponse } from "next/server";

import { isAdminUser } from "@/lib/admin";
import { searchEditorialAdminArticles } from "@/lib/editorial/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdminUser(user))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const query = new URL(request.url).searchParams.get("q") || "";
  if (query.trim().length < 2) return NextResponse.json({ articles: [] });

  try {
    const articles = await searchEditorialAdminArticles(query);
    return NextResponse.json({ articles });
  } catch {
    return NextResponse.json({ error: "search_failed" }, { status: 500 });
  }
}
