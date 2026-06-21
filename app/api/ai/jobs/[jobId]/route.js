import { NextResponse } from "next/server";

import { getQuestionBankJobSnapshot } from "@/lib/ai/question-bank-pipeline";
import {
  getLearningStudySetJobSnapshot,
  LEARNING_STUDY_SET_JOB_KIND
} from "@/lib/learning/study-set-pipeline";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function getJobKind({ jobId, userId }) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ai_generation_jobs")
    .select("job_kind")
    .eq("id", jobId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data?.job_kind || null;
}

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
    const jobKind = await getJobKind({ jobId: resolvedParams.jobId, userId: user.id });
    if (!jobKind) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const snapshot =
      jobKind === LEARNING_STUDY_SET_JOB_KIND
        ? await getLearningStudySetJobSnapshot({
            jobId: resolvedParams.jobId,
            userId: user.id
          })
        : await getQuestionBankJobSnapshot({
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
  } catch {
    return NextResponse.json(
      {
        error: "Nu am putut incarca statusul procesarii. Reincearca peste cateva momente."
      },
      { status: 500 }
    );
  }
}
