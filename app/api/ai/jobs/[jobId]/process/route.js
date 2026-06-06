import { NextResponse } from "next/server";

import { processQuestionBankJob } from "@/lib/ai/question-bank-pipeline";
import { normalizeOpenAIError } from "@/lib/openai/logging";
import { createClient } from "@/lib/supabase/server";
import { getAIQuestionBankSetupErrorMessage } from "@/lib/supabase/setup-status";

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
    const snapshot = await processQuestionBankJob({
      jobId: resolvedParams.jobId,
      userId: user.id
    });

    return NextResponse.json(snapshot, {
      headers: {
        "Cache-Control": "no-store, max-age=0"
      }
    });
  } catch (error) {
    const setupMessage = getAIQuestionBankSetupErrorMessage(error);
    if (setupMessage) {
      return NextResponse.json(
        {
          code: "setup_incomplete",
          error: setupMessage
        },
        { status: 503 }
      );
    }

    const normalizedError = normalizeOpenAIError(error);
    const message = normalizedError.message || "Nu am putut procesa jobul acum.";

    if (message.toLowerCase().includes("jobul nu exista")) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
