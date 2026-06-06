import { NextResponse } from "next/server";

import { getAcademicContext, isAcademicContextComplete } from "@/lib/academic/server";
import { assertSourceBucketReady, uploadSourceDocument } from "@/lib/ai/storage";
import { getBillingSnapshot } from "@/lib/billing";
import { DEMO_USER_ID } from "@/lib/demo-user";
import { hasOpenAIKey } from "@/lib/openai/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function getImportRequestContext() {
  if (!hasOpenAIKey()) {
    return {
      error: NextResponse.json(
        { error: "Procesarea nu este disponibila momentan. Incearca mai tarziu." },
        { status: 503 }
      )
    };
  }

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: NextResponse.json({ error: "unauthorized" }, { status: 401 })
    };
  }

  if (user.id === DEMO_USER_ID) {
    return {
      error: NextResponse.json(
        { error: "Procesarea reala este dezactivata in modul demo." },
        { status: 403 }
      )
    };
  }

  const academicContext = await getAcademicContext(user.id);
  if (!isAcademicContextComplete(academicContext)) {
    return {
      error: NextResponse.json({ error: "onboarding_required" }, { status: 403 })
    };
  }

  const billingSnapshot = await getBillingSnapshot(user.id);
  if (billingSnapshot.aiCredits < 1) {
    return {
      error: NextResponse.json(
        {
          error: "Nu ai incarcari disponibile. Adauga incarcari si incearca din nou.",
          code: "credits_required"
        },
        { status: 402 }
      )
    };
  }

  return { user, academicContext };
}

export async function createSourceDocumentForPreparedFile({ userId, preparedFile }) {
  await assertSourceBucketReady();
  const storageInfo = await uploadSourceDocument({
    userId,
    originalFilename: preparedFile.originalFilename,
    mimeType: preparedFile.mimeType,
    buffer: preparedFile.buffer
  });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ai_source_documents")
    .insert({
      user_id: userId,
      source_kind: preparedFile.sourceKind,
      storage_bucket: storageInfo.storageBucket,
      storage_path: storageInfo.storagePath,
      original_filename: preparedFile.originalFilename,
      mime_type: preparedFile.mimeType,
      size_bytes: preparedFile.sizeBytes,
      extracted_text: null,
      extraction_status: "pending",
      extraction_error: null
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  return data.id;
}

function toPublicImportError(error, fallback) {
  if (!(error instanceof Error)) {
    return fallback;
  }

  const message = error.message || "";
  const normalized = message.toLowerCase();
  if (
    normalized.includes("openai") ||
    normalized.includes("api") ||
    normalized.includes("model") ||
    normalized.includes("quota") ||
    normalized.includes("token") ||
    normalized.includes("responses.") ||
    normalized.includes("json schema")
  ) {
    return fallback;
  }

  return message;
}

export function jsonError(error, fallback = "A aparut o problema.") {
  return NextResponse.json(
    {
      error: toPublicImportError(error, fallback)
    },
    { status: 500 }
  );
}
