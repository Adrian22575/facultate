import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { getAcademicContext, isAcademicContextComplete } from "@/lib/academic/server";
import { createQuestionBankJob } from "@/lib/ai/question-bank-pipeline";
import {
  extractSourceText,
  prepareSourceFile,
  validateUpload
} from "@/lib/ai/extract-text";
import { GenerateTestInputSchema } from "@/lib/ai/schema";
import {
  assertSourceBucketReady,
  downloadSourceDocument,
  SOURCE_BUCKET_SETUP_MESSAGE,
  uploadSourceDocument
} from "@/lib/ai/storage";
import { getBillingSnapshot } from "@/lib/billing";
import { ensureSubjectAllocation, getSubjects } from "@/lib/data";
import { DEMO_USER_ID } from "@/lib/demo-user";
import { notifyAdminAiSourceFailed } from "@/lib/notifications/telegram";
import { hasOpenAIKey } from "@/lib/openai/server";
import { assertRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 300;
const LICENTA_GENERAL_LABEL = "Licenta generala";

function resolveSourceFailureStatus(error) {
  const normalized = String(error?.message || "").toLowerCase();

  if (
    normalized.includes("prea scurt") ||
    normalized.includes("nu contine") ||
    normalized.includes("text selectabil") ||
    normalized.includes("fisierul txt este gol") ||
    normalized.includes("fisierul docx") ||
    normalized.includes("pdf-ul pare scanat") ||
    normalized.includes("nu sunt acceptate")
  ) {
    return "rejected";
  }

  return "failed";
}

function trimAdminErrorMessage(error) {
  if (!(error instanceof Error)) {
    return "unknown_upload_error";
  }

  return error.message.slice(0, 2000);
}

function redirectWithMessage(request, kind, message, extraParams = {}) {
  const url = new URL("/materiale", request.url);
  url.searchParams.set(kind, encodeURIComponent(message));
  for (const [key, value] of Object.entries(extraParams)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }

    url.searchParams.set(key, String(value));
  }
  return NextResponse.redirect(url, { status: 303 });
}

function getSchemaError(error) {
  if (!(error instanceof ZodError)) {
    return null;
  }

  return error.issues[0]?.message || "Datele introduse nu sunt valide.";
}

function toUserSafeGenerateError(error) {
  if (!(error instanceof Error)) {
    return "Inputul nu a putut fi procesat.";
  }

  const normalized = error.message.toLowerCase();

  if (
    normalized.includes("bucket not found") ||
    normalized.includes("private-source-documents") ||
    normalized.includes("storage bucket")
  ) {
    return SOURCE_BUCKET_SETUP_MESSAGE;
  }

  if (
    normalized.includes("worker") ||
    normalized.includes("pdf.worker") ||
    normalized.includes("vendor-chunks") ||
    normalized.includes("cannot find module") ||
    normalized.includes("pdfjs") ||
    normalized.includes("legacy/build/pdf.mjs") ||
    normalized.includes("object.defineproperty") ||
    normalized.includes("invalid response") ||
    normalized.includes("timed out")
  ) {
    return "PDF-ul nu a putut fi citit corect. Incarca un PDF valid, cu text selectabil.";
  }

  return error.message;
}

function resolveSubjectLabel({ parsedInput, subjects }) {
  if (parsedInput.examType === "licenta") {
    return LICENTA_GENERAL_LABEL;
  }

  if (parsedInput.subjectId === "custom") {
    return parsedInput.subjectCustomName;
  }

  const selected = subjects.find((item) => item.id === parsedInput.subjectId);
  if (!selected) {
    throw new Error("Materia selectata nu este valida.");
  }

  return selected.title;
}

export async function POST(request) {
  if (!hasOpenAIKey()) {
    return redirectWithMessage(
      request,
      "error",
      "Procesarea nu este disponibila momentan. Incearca mai tarziu."
    );
  }

  const supabaseAuth = await createClient();
  const {
    data: { user }
  } = await supabaseAuth.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/auth/login?next=/materiale", request.url), {
      status: 303
    });
  }

  if (user.id === DEMO_USER_ID) {
    return redirectWithMessage(
      request,
      "error",
      "Procesarea reala este dezactivata in modul demo."
    );
  }

  const academicContext = await getAcademicContext(user.id);
  if (!isAcademicContextComplete(academicContext)) {
    return NextResponse.redirect(new URL("/onboarding", request.url), {
      status: 303
    });
  }

  const billingSnapshot = await getBillingSnapshot(user.id);
  if (billingSnapshot.aiCredits < 1) {
    return redirectWithMessage(
      request,
      "error",
      "Nu ai incarcari disponibile. Adauga incarcari si incearca din nou."
    );
  }

  const formData = await request.formData();
  const manualText =
    typeof formData.get("manualText") === "string"
      ? formData.get("manualText")
      : "";
  const file =
    formData.get("sourceFile") instanceof File ? formData.get("sourceFile") : null;
  const uploadedSourceDocumentId =
    typeof formData.get("uploadedSourceDocumentId") === "string"
      ? formData.get("uploadedSourceDocumentId")
      : "";

  const userType = academicContext?.profile?.user_type === "elev" ? "elev" : "student";
  const requestedExamType =
    formData.get("examType") === "licenta" ? "licenta" : "normal";
  const parsedInputCandidate = {
    userType,
    examType: requestedExamType,
    subjectId: formData.get("subjectId"),
    subjectCustomName:
      typeof formData.get("subjectCustomName") === "string"
        ? formData.get("subjectCustomName")
        : undefined,
    semester: formData.get("semester"),
    studentYear: formData.get("studentYear") || undefined,
    schoolClass:
      typeof formData.get("schoolClass") === "string"
        ? formData.get("schoolClass")
        : undefined,
    answerKeyPlacement:
      typeof formData.get("answerKeyPlacement") === "string"
        ? formData.get("answerKeyPlacement")
        : undefined
  };

  let parsedInput = null;
  try {
    parsedInput = GenerateTestInputSchema.parse(parsedInputCandidate);
  } catch (error) {
    return redirectWithMessage(
      request,
      "error",
      getSchemaError(error) || "Completeaza toate campurile obligatorii.",
      requestedExamType === "licenta" ? { examType: "licenta" } : {}
    );
  }

  try {
    await assertRateLimit({
      action: "ai_generate",
      subject: user.id,
      windowSeconds: 15 * 60,
      maxRequests: 6
    });

    const subjects = parsedInput.examType === "licenta" ? [] : await getSubjects();
    const subjectLabel = resolveSubjectLabel({ parsedInput, subjects });

    if (parsedInput.examType !== "licenta" && parsedInput.subjectId !== "custom") {
      await ensureSubjectAllocation({
        subjectId: parsedInput.subjectId,
        userType,
        studyYear: parsedInput.studentYear || null,
        semester: parsedInput.semester,
        schoolClass: parsedInput.schoolClass || null,
        createdByUserId: user.id
      });
    }

    validateUpload({
      file,
      manualText,
      uploadedSourceDocumentId
    });

    const supabase = createAdminClient();

    let preparedFile = null;
    let sourceDocument = null;
    let sourceAlreadyStored = false;

    if (uploadedSourceDocumentId) {
      const { data: uploadedSourceDocument, error: uploadedSourceError } = await supabase
        .from("ai_source_documents")
        .select(
          "id, user_id, source_kind, storage_bucket, storage_path, original_filename, mime_type, size_bytes"
        )
        .eq("id", uploadedSourceDocumentId)
        .eq("user_id", user.id)
        .single();

      if (uploadedSourceError || !uploadedSourceDocument) {
        throw new Error("Documentul urcat nu a fost gasit. Incarca fisierul din nou.");
      }

      if (
        !uploadedSourceDocument.storage_bucket ||
        !uploadedSourceDocument.storage_path
      ) {
        throw new Error("Uploadul fisierului nu a fost finalizat. Incearca din nou.");
      }

      let buffer = null;
      try {
        buffer = await downloadSourceDocument({
          storageBucket: uploadedSourceDocument.storage_bucket,
          storagePath: uploadedSourceDocument.storage_path
        });
      } catch {
        throw new Error("Uploadul fisierului nu a fost finalizat. Incearca din nou.");
      }

      preparedFile = {
        sourceKind: uploadedSourceDocument.source_kind,
        originalFilename: uploadedSourceDocument.original_filename || "document",
        mimeType: uploadedSourceDocument.mime_type || "application/octet-stream",
        sizeBytes: Number(uploadedSourceDocument.size_bytes || buffer.length),
        buffer
      };
      sourceDocument = { id: uploadedSourceDocument.id };
      sourceAlreadyStored = true;
    } else if (file) {
      preparedFile = await prepareSourceFile(file);
    }

    if (!sourceDocument) {
      const pendingSourcePayload = preparedFile
        ? {
            user_id: user.id,
            source_kind: preparedFile.sourceKind,
            storage_bucket: null,
            storage_path: null,
            original_filename: preparedFile.originalFilename,
            mime_type: preparedFile.mimeType,
            size_bytes: preparedFile.sizeBytes,
            extracted_text: null,
            extraction_status: "pending",
            extraction_error: null
          }
        : {
            user_id: user.id,
            source_kind: "manual",
            storage_bucket: null,
            storage_path: null,
            original_filename: null,
            mime_type: "text/plain",
            size_bytes: Buffer.byteLength(String(manualText || ""), "utf8"),
            extracted_text: null,
            extraction_status: "pending",
            extraction_error: null
          };

      const { data: insertedSourceDocument, error: sourceInsertError } = await supabase
        .from("ai_source_documents")
        .insert(pendingSourcePayload)
        .select("id")
        .single();

      if (sourceInsertError) {
        throw sourceInsertError;
      }

      sourceDocument = insertedSourceDocument;
    }

    try {
      if (preparedFile && !sourceAlreadyStored) {
        await assertSourceBucketReady();
        const storageInfo = await uploadSourceDocument({
          userId: user.id,
          originalFilename: preparedFile.originalFilename,
          mimeType: preparedFile.mimeType,
          buffer: preparedFile.buffer
        });

        const { error: storageUpdateError } = await supabase
          .from("ai_source_documents")
          .update({
            storage_bucket: storageInfo.storageBucket,
            storage_path: storageInfo.storagePath
          })
          .eq("id", sourceDocument.id);

        if (storageUpdateError) {
          throw storageUpdateError;
        }
      }

      const isLicentaPdfUpload = parsedInput.examType === "licenta" && preparedFile?.sourceKind === "pdf";
      let extracted = null;
      let extractionMetadata = null;

      try {
        extracted = await extractSourceText({
          file,
          manualText,
          examType: parsedInput.examType,
          subjectName: subjectLabel,
          userId: user.id,
          sourceDocumentId: sourceDocument.id,
          preparedFile,
          allowPdfOpenAIFallback: !isLicentaPdfUpload
        });
        extractionMetadata = {
          ...(extracted.extractionMetadata || {}),
          sourceKind: extracted.sourceKind,
          sourceMimeType: extracted.mimeType
        };
      } catch (localPdfError) {
        if (!isLicentaPdfUpload) {
          throw localPdfError;
        }

        const localPdfErrorMessage = trimAdminErrorMessage(localPdfError);
        const { error: sourceFallbackError } = await supabase
          .from("ai_source_documents")
          .update({
            source_kind: "pdf",
            original_filename: preparedFile.originalFilename,
            mime_type: preparedFile.mimeType,
            size_bytes: preparedFile.sizeBytes,
            extracted_text: null,
            extraction_status: "succeeded",
            extraction_error: localPdfErrorMessage
          })
          .eq("id", sourceDocument.id);

        if (sourceFallbackError) {
          throw sourceFallbackError;
        }

        const jobId = await createQuestionBankJob({
          userId: user.id,
          sourceDocumentId: sourceDocument.id,
          sourceFilename: preparedFile.originalFilename,
          extractionMetadata: {
            sourceKind: "pdf",
            sourceMimeType: preparedFile.mimeType,
            pdfProcessingMode: "openai_pdf_batched",
            processingMode: "openai_pdf_batched",
            extractionSource: "openai_file",
            localPdfExtractionFailed: true,
            localPdfExtractionError: localPdfErrorMessage,
            pdfPageCount: null,
            pdfExtractedCharacterCount: 0
          },
          parsedInput: {
            ...parsedInput,
            subjectLabel
          },
          academicContext
        });

        return NextResponse.redirect(new URL(`/materiale/jobs/${jobId}`, request.url), {
          status: 303
        });
      }

      const { error: sourceSuccessError } = await supabase
        .from("ai_source_documents")
        .update({
          source_kind: extracted.sourceKind,
          original_filename: extracted.originalFilename,
          mime_type: extracted.mimeType,
          size_bytes: extracted.sizeBytes,
          extracted_text: extracted.extractedText,
          extraction_status: "succeeded",
          extraction_error: null
        })
        .eq("id", sourceDocument.id);

      if (sourceSuccessError) {
        throw sourceSuccessError;
      }

      const jobId = await createQuestionBankJob({
        userId: user.id,
        sourceDocumentId: sourceDocument.id,
        sourceFilename: extracted.originalFilename,
        extractionMetadata,
        parsedInput: {
          ...parsedInput,
          subjectLabel
        },
        academicContext
      });

      return NextResponse.redirect(new URL(`/materiale/jobs/${jobId}`, request.url), {
        status: 303
      });
    } catch (error) {
      await supabase
        .from("ai_source_documents")
        .update({
          extraction_status: resolveSourceFailureStatus(error),
          extraction_error: trimAdminErrorMessage(error)
        })
        .eq("id", sourceDocument.id);

      await notifyAdminAiSourceFailed({
        sourceDocumentId: sourceDocument.id,
        user,
        sourceFilename:
          preparedFile?.originalFilename ||
          (file instanceof File ? file.name : null) ||
          "manual_text",
        examType: parsedInput.examType,
        error
      });

      throw error;
    }
  } catch (error) {
    return redirectWithMessage(
      request,
      "error",
      toUserSafeGenerateError(error),
      requestedExamType === "licenta" ? { examType: "licenta" } : {}
    );
  }
}
