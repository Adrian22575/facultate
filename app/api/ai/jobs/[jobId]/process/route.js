import { NextResponse } from "next/server";

import { processQuestionBankJob } from "@/lib/ai/question-bank-pipeline";
import { requeueCreditBackedGenerationJob } from "@/lib/ai/job-capacity";
import {
  LEARNING_STUDY_SET_JOB_KIND,
  processLearningStudySetJob
} from "@/lib/learning/study-set-pipeline";
import { getAcademicContext } from "@/lib/academic/server";
import { normalizeOpenAIError } from "@/lib/openai/logging";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getAIQuestionBankSetupErrorMessage } from "@/lib/supabase/setup-status";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

async function getJobForProcessingRequest({ jobId, userId }) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ai_generation_jobs")
    .select("job_kind, status")
    .eq("id", jobId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data || null;
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
    const job = await getJobForProcessingRequest({
      jobId: resolvedParams.jobId,
      userId: user.id
    });
    if (!job) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    if (job.status === "failed") {
      await requeueCreditBackedGenerationJob({
        jobId: resolvedParams.jobId,
        userId: user.id
      });
    }

    const snapshot =
      job.job_kind === LEARNING_STUDY_SET_JOB_KIND
        ? await processLearningStudySetJob({
            jobId: resolvedParams.jobId,
            userId: user.id,
            academicContext: await getAcademicContext(user.id)
          })
        : await processQuestionBankJob({
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
    const technicalMessage = normalizedError.message || "";

    if (technicalMessage.toLowerCase().includes("jobul nu exista")) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    if (technicalMessage.toLowerCase().includes("nu ai suficiente incarcari")) {
      return NextResponse.json(
        {
          error: "Nu ai suficiente incarcari disponibile pentru a relua procesarea.",
          actionHref: "/cont?section=credits"
        },
        { status: 409 }
      );
    }

    const message = normalizedError.isTimeoutLike
      ? "Procesarea dureaza mai mult decat era estimat. Poti reveni din Activitate peste cateva momente."
      : "Procesarea s-a oprit temporar. Incearca din nou din Activitate.";

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
