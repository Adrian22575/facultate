import { NextResponse } from "next/server";

import { createImportQuestion, getImportQuestions } from "@/lib/ai/import-pipeline";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  const resolvedParams = await params;
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "all";
  const page = Number(url.searchParams.get("page") || 1) || 1;
  const pageSize = Number(url.searchParams.get("pageSize") || 10) || 10;
  const query = url.searchParams.get("q") || "";

  try {
    const payload = await getImportQuestions({
      importJobId: resolvedParams.id,
      userId: user.id,
      status,
      page,
      pageSize,
      query
    });

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "no-store, max-age=0"
      }
    });
  } catch (error) {
    console.error("import_questions_route_failed", {
      importJobId: resolvedParams.id,
      status,
      page,
      pageSize,
      hasQuery: Boolean(query),
      message: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nu am putut incarca intrebarile." },
      { status: 500 }
    );
  }
}

export async function POST(request, { params }) {
  const resolvedParams = await params;
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const payload = await createImportQuestion({
      importJobId: resolvedParams.id,
      userId: user.id,
      questionText: body?.questionText,
      options: body?.options,
      correctOptionIndex: body?.correctOptionIndex,
      markReviewed: body?.markReviewed
    });

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "no-store, max-age=0"
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nu am putut adauga intrebarea." },
      { status: 500 }
    );
  }
}
