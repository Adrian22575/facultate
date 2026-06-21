import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { getAcademicContext } from "@/lib/academic/server";
import {
  claimNextImportJob,
  processImportJob,
  releaseClaimedImportJob
} from "@/lib/ai/import-pipeline";
import {
  claimNextQuestionBankJob,
  processQuestionBankJob,
  releaseQuestionBankJobLock
} from "@/lib/ai/question-bank-pipeline";
import {
  claimNextLearningStudySetJob,
  processLearningStudySetJob,
  releaseLearningStudySetJobLock
} from "@/lib/learning/study-set-pipeline";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const WORKERS = [
  {
    kind: "learning",
    claim: claimNextLearningStudySetJob,
    process: async (claimed) =>
      processLearningStudySetJob({
        jobId: claimed.jobId,
        userId: claimed.userId,
        academicContext: await getAcademicContext(claimed.userId),
        lockAlreadyAcquired: true
      }),
    release: (claimed) => releaseLearningStudySetJobLock(claimed.jobId)
  },
  {
    kind: "questions",
    claim: claimNextQuestionBankJob,
    process: (claimed) =>
      processQuestionBankJob({
        jobId: claimed.jobId,
        userId: claimed.userId,
        lockAlreadyAcquired: true
      }),
    release: (claimed) => releaseQuestionBankJobLock(claimed.jobId)
  },
  {
    kind: "import",
    claim: claimNextImportJob,
    process: (claimed) =>
      processImportJob({
        importJobId: claimed.importJobId,
        userId: claimed.userId,
        lockAlreadyAcquired: true
      }),
    release: (claimed) => releaseClaimedImportJob(claimed.importJobId)
  }
];

async function claimNextBackgroundJob() {
  const offset = new Date().getUTCMinutes() % WORKERS.length;
  const orderedWorkers = [...WORKERS.slice(offset), ...WORKERS.slice(0, offset)];

  for (const worker of orderedWorkers) {
    const claimed = await worker.claim();
    if (claimed) return { worker, claimed };
  }

  return null;
}

function hasValidCronAuthorization(request) {
  const secret = String(process.env.CRON_SECRET || "");
  const authorization = String(request.headers.get("authorization") || "");
  const expected = `Bearer ${secret}`;

  if (secret.length < 24 || authorization.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(authorization), Buffer.from(expected));
}

export async function GET(request) {
  if (!hasValidCronAuthorization(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let work = null;
  try {
    work = await claimNextBackgroundJob();
    if (!work) {
      return NextResponse.json({ ok: true, processed: false });
    }

    const snapshot = await work.worker.process(work.claimed);

    return NextResponse.json({
      ok: true,
      processed: true,
      kind: work.worker.kind,
      recovered: work.claimed.recovered,
      status: snapshot?.status || "unknown"
    });
  } catch (error) {
    if (work) {
      await work.worker.release(work.claimed).catch(() => null);
    }
    console.error("background_cron_job_failed", {
      kind: work?.worker.kind || "claim",
      jobId: work?.claimed.jobId || work?.claimed.importJobId || null,
      message: error instanceof Error ? error.message : "unknown_error"
    });

    return NextResponse.json(
      { ok: false, processed: true, error: "processing_failed" },
      { status: 500 }
    );
  }
}
