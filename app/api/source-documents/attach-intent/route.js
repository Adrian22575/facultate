import { NextResponse } from "next/server";

import { getAcademicContext, isAcademicContextComplete } from "@/lib/academic/server";
import {
  inferMimeTypeFromName,
  inferSourceKindFromMimeType,
  sanitizeFilename,
  validateUploadMetadata
} from "@/lib/ai/extract-text";
import {
  assertSourceBucketReady,
  buildStoragePath,
  SOURCE_BUCKET
} from "@/lib/ai/storage";
import { AI_SOURCE_UPLOAD_MAX_BYTES } from "@/lib/ai/upload-limits";
import { DEMO_USER_ID } from "@/lib/demo-user";
import { assertRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const TARGET_TYPES = new Set(["question_bank", "licenta_session"]);

function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function requireUploadContext() {
  const supabaseAuth = await createClient();
  const {
    data: { user }
  } = await supabaseAuth.auth.getUser();

  if (!user) {
    return { error: jsonError("Trebuie sa fii autentificat ca sa urci fisiere.", 401) };
  }

  if (user.id === DEMO_USER_ID) {
    return { error: jsonError("Uploadul real este dezactivat in modul demo.", 403) };
  }

  let academicContext = null;
  try {
    academicContext = await getAcademicContext(user.id);
  } catch {
    return { error: jsonError("Nu am putut verifica profilul tau. Incearca din nou.", 503) };
  }

  if (!isAcademicContextComplete(academicContext)) {
    return { error: jsonError("Finalizeaza onboarding-ul inainte sa urci fisiere.", 403) };
  }

  return { user };
}

async function assertTargetBelongsToUser({ admin, userId, targetType, targetId }) {
  if (!TARGET_TYPES.has(targetType) || !targetId) {
    throw new Error("Alege un material valid pentru atasarea fisierului.");
  }

  const table = targetType === "question_bank" ? "ai_question_banks" : "ai_licenta_import_sessions";
  const { data, error } = await admin
    .from(table)
    .select("id, user_id")
    .eq("id", targetId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Materialul nu a fost gasit.");
  }
}

export async function POST(request) {
  const context = await requireUploadContext();
  if (context.error) {
    return context.error;
  }

  let payload = null;
  try {
    payload = await request.json();
  } catch {
    return jsonError("Datele fisierului nu au putut fi citite.");
  }

  const targetType = String(payload?.targetType || "");
  const targetId = String(payload?.targetId || "");
  const originalFilename = sanitizeFilename(payload?.originalFilename || "document");
  const mimeType = payload?.mimeType || inferMimeTypeFromName(originalFilename);
  const sizeBytes = Number(payload?.sizeBytes || 0);

  try {
    validateUploadMetadata({
      filename: originalFilename,
      mimeType,
      sizeBytes
    });

    await assertRateLimit({
      action: "source_document_attach_intent",
      subject: context.user.id,
      windowSeconds: 15 * 60,
      maxRequests: 20
    });

    await assertSourceBucketReady();

    const admin = createAdminClient();
    await assertTargetBelongsToUser({
      admin,
      userId: context.user.id,
      targetType,
      targetId
    });

    const storagePath = buildStoragePath(context.user.id, originalFilename);
    const { data, error } = await admin
      .from("ai_source_documents")
      .insert({
        user_id: context.user.id,
        source_kind: inferSourceKindFromMimeType(mimeType, originalFilename),
        storage_bucket: SOURCE_BUCKET,
        storage_path: storagePath,
        original_filename: originalFilename,
        mime_type: mimeType,
        size_bytes: sizeBytes,
        extracted_text: null,
        extraction_status: "pending",
        extraction_error: null
      })
      .select("id")
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      sourceDocumentId: data.id,
      storageBucket: SOURCE_BUCKET,
      storagePath,
      originalFilename,
      mimeType,
      maxUploadSizeBytes: AI_SOURCE_UPLOAD_MAX_BYTES
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const normalized = message.toLowerCase();
    const isSafeValidationError = [
      "fisierul selectat pare gol",
      "fisierul depaseste limita",
      "sunt acceptate doar fisiere",
      "materialul nu a fost gasit",
      "alege un material valid"
    ].some((part) => normalized.includes(part));

    return jsonError(
      error?.code === "RATE_LIMITED" || isSafeValidationError
        ? message
        : "Nu am putut pregati uploadul fisierului. Incearca din nou peste cateva momente.",
      isSafeValidationError ? 400 : 500
    );
  }
}
