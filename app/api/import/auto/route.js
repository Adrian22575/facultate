import { NextResponse } from "next/server";

import {
  buildPreparedFileFromFormFile,
  createAutoImportJob,
  getImportStatus
} from "@/lib/ai/import-pipeline";
import {
  createSourceDocumentForPreparedFile,
  getImportRequestContext,
  jsonError
} from "@/app/api/import/_shared";
import { createAdminClient } from "@/lib/supabase/admin";
import { cleanupUnusedSourceDocumentsForUser } from "@/lib/ai/source-document-cleanup";

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

export async function POST(request) {
  const context = await getImportRequestContext({ returnTo: "/materiale/importa" });
  if (context.error) {
    return context.error;
  }

  let requestId = null;
  let sourceDocumentId = null;
  try {
    const formData = await request.formData();
    requestId = normalizeRequestId(formData.get("requestId"));
    const existing = await findExistingRequest(context.user.id, requestId);
    if (existing) return NextResponse.json(existing);
    const file = formData.get("sourceFile") instanceof File ? formData.get("sourceFile") : null;
    if (!file) {
      return NextResponse.json({ error: "Alege fisierul pentru import." }, { status: 400 });
    }

    const preparedFile = await buildPreparedFileFromFormFile(file);
    sourceDocumentId = await createSourceDocumentForPreparedFile({
      userId: context.user.id,
      preparedFile
    });

    const status = await createAutoImportJob({
      userId: context.user.id,
      sourceDocumentId,
      sourceType: preparedFile.sourceKind,
      fileName: preparedFile.originalFilename,
      academicContext: context.academicContext,
      metadata: {
        ...(requestId ? { requestId } : {}),
        sourceMimeType: preparedFile.mimeType,
        sourceSizeBytes: preparedFile.sizeBytes
      }
    });

    return NextResponse.json(status, {
      headers: {
        "Cache-Control": "no-store, max-age=0"
      }
    });
  } catch (error) {
    if (error?.code === "23505") {
      try {
        const existing = await findExistingRequest(context.user.id, requestId);
        if (existing) {
          if (sourceDocumentId) {
            await cleanupUnusedSourceDocumentsForUser(
              createAdminClient(),
              context.user.id,
              [sourceDocumentId]
            ).catch(() => {});
          }
          return NextResponse.json(existing);
        }
      } catch {
        // Fall through to the safe import error.
      }
    }
    return jsonError(error, "Nu am putut porni importul automat.");
  }
}
