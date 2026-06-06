import { NextResponse } from "next/server";

import { getImportJobMonitor } from "@/lib/ai/import-pipeline";
import { getQuestionBankJobMonitor } from "@/lib/ai/question-bank-pipeline";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function getSortTimestamp(item) {
  const parsed = Date.parse(item?.updatedAt || item?.completedAt || item?.createdAt || "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function mergeMonitors(generationMonitor, importMonitor) {
  const activeJobs = [
    ...(generationMonitor?.activeJobs || []).map((job) => ({ ...job, kind: job.kind || "generation" })),
    ...(importMonitor?.activeJobs || [])
  ].sort((left, right) => getSortTimestamp(right) - getSortTimestamp(left));

  const terminalCandidates = [
    generationMonitor?.terminalJob
      ? { ...generationMonitor.terminalJob, kind: generationMonitor.terminalJob.kind || "generation" }
      : null,
    importMonitor?.terminalJob || null
  ].filter(Boolean);

  terminalCandidates.sort((left, right) => getSortTimestamp(right) - getSortTimestamp(left));

  return {
    activeJobs,
    terminalJob: terminalCandidates[0] || null,
    generatedAt: new Date().toISOString()
  };
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const [generationMonitor, importMonitor] = await Promise.all([
      getQuestionBankJobMonitor(user.id),
      getImportJobMonitor(user.id)
    ]);

    return NextResponse.json(mergeMonitors(generationMonitor, importMonitor), {
      headers: {
        "Cache-Control": "no-store, max-age=0"
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Nu am putut incarca monitorizarea joburilor."
      },
      { status: 500 }
    );
  }
}
