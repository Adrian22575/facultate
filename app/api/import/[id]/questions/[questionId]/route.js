import { NextResponse } from "next/server";

import { deleteImportQuestion, updateImportQuestion } from "@/lib/ai/import-pipeline";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getUser() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  return user || null;
}

export async function PATCH(request, { params }) {
  const resolvedParams = await params;
  const user = await getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const payload = await updateImportQuestion({
      importJobId: resolvedParams.id,
      questionId: resolvedParams.questionId,
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
    console.error("import_question_patch_failed", {
      importJobId: resolvedParams.id,
      questionId: resolvedParams.questionId,
      message: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nu am putut salva intrebarea." },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  const resolvedParams = await params;
  const user = await getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const payload = await deleteImportQuestion({
      importJobId: resolvedParams.id,
      questionId: resolvedParams.questionId,
      userId: user.id
    });

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "no-store, max-age=0"
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nu am putut elimina intrebarea." },
      { status: 500 }
    );
  }
}
