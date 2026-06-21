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
import { getBillingSnapshot } from "@/lib/billing";
import { DEMO_USER_ID } from "@/lib/demo-user";
import { hasOpenAIKey } from "@/lib/openai/server";
import { assertRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request) {
  const supabaseAuth = await createClient();
  const {
    data: { user }
  } = await supabaseAuth.auth.getUser();

  if (!user) {
    return jsonError("Trebuie sa fii autentificat ca sa urci fisiere.", 401);
  }

  if (user.id === DEMO_USER_ID) {
    return jsonError("Procesarea reala este dezactivata in modul demo.", 403);
  }

  if (!hasOpenAIKey()) {
    return jsonError("Procesarea nu este disponibila momentan. Incearca mai tarziu.", 503);
  }

  let academicContext = null;
  try {
    academicContext = await getAcademicContext(user.id);
  } catch {
    return jsonError("Nu am putut verifica profilul tau. Incearca din nou.", 503);
  }
  if (!isAcademicContextComplete(academicContext)) {
    return jsonError("Finalizeaza onboarding-ul inainte sa urci fisiere.", 403);
  }

  let billingSnapshot = null;
  try {
    billingSnapshot = await getBillingSnapshot(user.id);
  } catch {
    return jsonError("Nu am putut verifica incarcarile disponibile. Incearca din nou.", 503);
  }
  if (billingSnapshot.aiCredits < 1) {
    return NextResponse.json(
      {
        error: "Nu ai incarcari disponibile. Adauga incarcari si incearca din nou.",
        actionHref: "/cont?section=credits&returnTo=%2Fmateriale%2Finvata"
      },
      { status: 402 }
    );
  }

  let payload = null;
  try {
    payload = await request.json();
  } catch {
    return jsonError("Datele fisierului nu au putut fi citite.");
  }

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
      action: "ai_source_upload_intent",
      subject: user.id,
      windowSeconds: 15 * 60,
      maxRequests: 12
    });

    await assertSourceBucketReady();

    const storagePath = buildStoragePath(user.id, originalFilename);
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("ai_source_documents")
      .insert({
        user_id: user.id,
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
      "sunt acceptate doar fisiere"
    ].some((part) => normalized.includes(part));

    return jsonError(
      error?.code === "RATE_LIMITED" || isSafeValidationError
        ? message
        : "Nu am putut pregati uploadul fisierului. Incearca din nou peste cateva momente.",
      400
    );
  }
}
