import { NextResponse } from "next/server";

import { getQuestionBankJobSnapshot } from "@/lib/ai/question-bank-pipeline";
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

  try {
    const snapshot = await getQuestionBankJobSnapshot({
      jobId: resolvedParams.jobId,
      userId: user.id
    });

    if (!snapshot) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    return NextResponse.json(snapshot, {
      headers: {
        "Cache-Control": "no-store, max-age=0"
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Nu am putut incarca statusul jobului."
      },
      { status: 500 }
    );
  }
}
