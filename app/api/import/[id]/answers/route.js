import { NextResponse } from "next/server";

import { jsonError } from "@/app/api/import/_shared";
import { applySupplementalAnswerKey } from "@/lib/ai/import-pipeline";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

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
    const payload = await request.json().catch(() => ({}));
    const result = await applySupplementalAnswerKey({
      importJobId: resolvedParams.id,
      userId: user.id,
      answerKeyText: payload?.answerKeyText || ""
    });

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store, max-age=0"
      }
    });
  } catch (error) {
    return jsonError(error, "Nu am putut potrivi raspunsurile.");
  }
}
