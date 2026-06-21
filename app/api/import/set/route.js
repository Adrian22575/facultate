import { NextResponse } from "next/server";

import { extractSourceText, prepareSourceFile } from "@/lib/ai/extract-text";
import { createSetImportJob, getImportStatus } from "@/lib/ai/import-pipeline";
import { createAdminClient } from "@/lib/supabase/admin";
import { getImportRequestContext, jsonError } from "@/app/api/import/_shared";

export const runtime = "nodejs";
export const maxDuration = 300;

function normalizeRequestId(value) {
  const requestId = String(value || "").trim();
  return /^[a-z0-9_.:-]{12,120}$/i.test(requestId) ? requestId : null;
}

async function findExistingRequest(userId, requestId) {
  if (!requestId) return null;
  const { data, error } = await createAdminClient()
    .from("ai_import_jobs")
    .select("id")
    .eq("user_id", userId)
    .eq("metadata->>requestId", requestId)
    .maybeSingle();
  if (error) throw error;
  return data?.id ? getImportStatus({ importJobId: data.id, userId }) : null;
}

async function readOptionalFileText({ file, userId, label }) {
  if (!(file instanceof File) || file.size <= 0) {
    return {
      text: "",
      metadata: {}
    };
  }

  const preparedFile = await prepareSourceFile(file);
  const extracted = await extractSourceText({
    manualText: "",
    preparedFile,
    examType: "licenta",
    subjectName: "Licenta generala",
    userId,
    allowPdfOpenAIFallback: false
  });

  if (!extracted.extractedText) {
    throw new Error(`Fisierul pentru ${label} nu contine text util.`);
  }

  return {
    text: extracted.extractedText,
    metadata: {
      sourceKind: preparedFile.sourceKind,
      originalFilename: preparedFile.originalFilename,
      sizeBytes: preparedFile.sizeBytes,
      ...(extracted.extractionMetadata || {})
    }
  };
}

export async function POST(request) {
  const context = await getImportRequestContext({ returnTo: "/materiale/licenta" });
  if (context.error) {
    return context.error;
  }

  try {
    const formData = await request.formData();
    const requestId = normalizeRequestId(formData.get("requestId"));
    const existing = await findExistingRequest(context.user.id, requestId);
    if (existing) return NextResponse.json(existing);
    const licentaSessionId = String(formData.get("licentaSessionId") || "").trim() || null;
    const title = String(formData.get("title") || "").trim();
    const contentText = String(formData.get("contentText") || "").trim();
    const questionsText = String(formData.get("questionsText") || "").trim();
    const answerKeyText = String(formData.get("answerKeyText") || "").trim();
    const contentFile = formData.get("contentFile") instanceof File ? formData.get("contentFile") : null;
    const questionsFile = formData.get("questionsFile") instanceof File ? formData.get("questionsFile") : null;
    const answerKeyFile = formData.get("answerKeyFile") instanceof File ? formData.get("answerKeyFile") : null;

    const fileContent = await readOptionalFileText({
      file: contentFile,
      userId: context.user.id,
      label: "set"
    });
    const fileQuestions = await readOptionalFileText({
      file: questionsFile,
      userId: context.user.id,
      label: "intrebari"
    });
    const fileAnswerKey = await readOptionalFileText({
      file: answerKeyFile,
      userId: context.user.id,
      label: "barem"
    });
    const filePageCount =
      Number(
        fileContent.metadata?.pdfPageCount ||
          fileQuestions.metadata?.pdfPageCount ||
          fileAnswerKey.metadata?.pdfPageCount ||
          0
      ) || 0;
    const setFileWarning =
      filePageCount >= 60
        ? "Fisierul pare mare pentru un singur set. Imparte materialul in seturi mai mici pentru verificare mai usoara."
        : null;

    const status = await createSetImportJob({
      userId: context.user.id,
      licentaSessionId,
      title,
      contentText: [contentText, fileContent.text].filter(Boolean).join("\n\n"),
      questionsText: [questionsText, fileQuestions.text].filter(Boolean).join("\n\n"),
      answerKeyText: [answerKeyText, fileAnswerKey.text].filter(Boolean).join("\n\n"),
      academicContext: context.academicContext,
      metadata: {
        ...(requestId ? { requestId } : {}),
        hasContentFile: Boolean(fileContent.text),
        hasQuestionsFile: Boolean(fileQuestions.text),
        hasAnswerKeyFile: Boolean(fileAnswerKey.text),
        setFileWarning
      }
    });

    return NextResponse.json(status, {
      headers: {
        "Cache-Control": "no-store, max-age=0"
      }
    });
  } catch (error) {
    return jsonError(error, "Nu am putut procesa setul.");
  }
}
