import { NextResponse } from "next/server";

import { getAcademicContext, isAcademicContextComplete } from "@/lib/academic/server";
import {
  assertSourceBucketReady,
  deleteSourceDocumentObject,
  uploadSourceDocument
} from "@/lib/ai/storage";
import { getBillingSnapshot } from "@/lib/billing";
import { DEMO_USER_ID } from "@/lib/demo-user";
import { hasOpenAIKey } from "@/lib/openai/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function getImportRequestContext({ returnTo = "/materiale" } = {}) {
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

  let academicContext = null;
  try {
    academicContext = await getAcademicContext(user.id);
  } catch {
    return {
      error: NextResponse.json(
        { error: "Nu am putut verifica profilul tau. Incearca din nou." },
        { status: 503 }
      )
    };
  }
  if (!isAcademicContextComplete(academicContext)) {
    return {
      error: NextResponse.json(
        {
          error: "Finalizeaza comunitatea inainte sa procesezi materiale.",
          actionHref: `/onboarding?next=${encodeURIComponent(returnTo)}`
        },
        { status: 403 }
      )
    };
  }

  let billingSnapshot = null;
  try {
    billingSnapshot = await getBillingSnapshot(user.id);
  } catch {
    return {
      error: NextResponse.json(
        { error: "Nu am putut verifica incarcarile disponibile. Incearca din nou." },
        { status: 503 }
      )
    };
  }
  if (billingSnapshot.aiCredits < 1) {
    return {
      error: NextResponse.json(
        {
          error: "Nu ai incarcari disponibile. Adauga incarcari si incearca din nou.",
          code: "credits_required",
          actionHref: `/cont?section=credits&returnTo=${encodeURIComponent(returnTo)}`
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
    await deleteSourceDocumentObject({
      storageBucket: storageInfo.storageBucket,
      storagePath: storageInfo.storagePath
    }).catch(() => {});
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
    normalized.includes("json schema") ||
    normalized.includes("relation ") ||
    normalized.includes("column ") ||
    normalized.includes("duplicate key") ||
    normalized.includes("violates") ||
    normalized.includes("invalid input syntax") ||
    normalized.includes("permission denied") ||
    normalized.includes("row-level security") ||
    normalized.includes("schema cache") ||
    normalized.includes("pgrst") ||
    normalized.includes("jwt") ||
    normalized.includes("supabase") ||
    normalized.includes("fetch failed") ||
    normalized.includes("network") ||
    normalized.includes("timeout")
  ) {
    return fallback;
  }

  return message;
}

export function jsonError(error, fallback = "A aparut o problema.") {
  const publicError = toPublicImportError(error, fallback);
  const status = error?.code === "RATE_LIMITED" ? 429 : publicError === fallback ? 500 : 400;
  return NextResponse.json(
    {
      error: publicError
    },
    { status }
  );
}
