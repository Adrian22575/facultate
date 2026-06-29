import { NextResponse } from "next/server";

import { getAcademicContext, isAcademicContextComplete } from "@/lib/academic/server";
import { deleteSourceDocumentObject } from "@/lib/ai/storage";
import { DEMO_USER_ID } from "@/lib/demo-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const TARGET_TYPES = new Set(["question_bank", "licenta_session"]);

function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function requireUser() {
  const supabaseAuth = await createClient();
  const {
    data: { user }
  } = await supabaseAuth.auth.getUser();

  if (!user) {
    return { error: jsonError("Trebuie sa fii autentificat ca sa atasezi fisiere.", 401) };
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
    return { error: jsonError("Finalizeaza onboarding-ul inainte sa atasezi fisiere.", 403) };
  }

  return { user };
}

async function cleanupPendingDocument(admin, document) {
  if (!document?.id) {
    return;
  }

  await deleteSourceDocumentObject({
    storageBucket: document.storage_bucket,
    storagePath: document.storage_path
  }).catch(() => {});

  try {
    await admin
      .from("ai_source_documents")
      .delete()
      .eq("id", document.id)
      .eq("user_id", document.user_id);
  } catch {
    // Cleanup is best-effort; the visible attachment error is more useful to the user.
  }
}

async function getOwnedSourceDocument({ admin, userId, sourceDocumentId }) {
  const { data, error } = await admin
    .from("ai_source_documents")
    .select("id, user_id, storage_bucket, storage_path, original_filename")
    .eq("id", sourceDocumentId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Fisierul original nu a fost gasit.");
  }

  if (!data.storage_bucket || !data.storage_path) {
    throw new Error("Uploadul fisierului nu a fost finalizat.");
  }

  return data;
}

async function attachToQuestionBank({ admin, userId, targetId, sourceDocument }) {
  const { data: bank, error: bankError } = await admin
    .from("ai_question_banks")
    .select("id, user_id, metadata, source_document_id")
    .eq("id", targetId)
    .eq("user_id", userId)
    .maybeSingle();

  if (bankError) {
    throw bankError;
  }

  if (!bank) {
    throw new Error("Materialul nu a fost gasit.");
  }

  const attachedAt = new Date().toISOString();
  const { error: updateError } = await admin
    .from("ai_question_banks")
    .update({
      source_document_id: sourceDocument.id,
      metadata: {
        ...(bank.metadata || {}),
        originalSourceDocumentAttachedAt: attachedAt,
        originalSourceFilename: sourceDocument.original_filename || null
      }
    })
    .eq("id", bank.id)
    .eq("user_id", userId);

  if (updateError) {
    throw updateError;
  }

  return {
    previousSourceDocumentId: bank.source_document_id || null,
    target: { type: "question_bank", id: bank.id }
  };
}

async function attachToLicentaSession({ admin, userId, targetId, sourceDocument }) {
  const { data: session, error: sessionError } = await admin
    .from("ai_licenta_import_sessions")
    .select("*")
    .eq("id", targetId)
    .eq("user_id", userId)
    .maybeSingle();

  if (sessionError) {
    throw sessionError;
  }

  if (!session) {
    throw new Error("Licenta nu a fost gasita.");
  }

  const attachedAt = new Date().toISOString();
  const { error: updateSessionError } = await admin
    .from("ai_licenta_import_sessions")
    .update({
      source_document_id: sourceDocument.id,
      metadata: {
        ...(session.metadata || {}),
        originalSourceDocumentAttachedAt: attachedAt,
        originalSourceFilename: sourceDocument.original_filename || null
      }
    })
    .eq("id", session.id)
    .eq("user_id", userId);

  if (updateSessionError) {
    throw updateSessionError;
  }

  if (session.result_bank_id) {
    const { data: bank } = await admin
      .from("ai_question_banks")
      .select("id, metadata")
      .eq("id", session.result_bank_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (bank) {
      const { error: updateBankError } = await admin
        .from("ai_question_banks")
        .update({
          source_document_id: sourceDocument.id,
          metadata: {
            ...(bank.metadata || {}),
            originalSourceDocumentAttachedAt: attachedAt,
            originalSourceFilename: sourceDocument.original_filename || null
          }
        })
        .eq("id", bank.id)
        .eq("user_id", userId);

      if (updateBankError) {
        throw updateBankError;
      }
    }
  }

  return {
    previousSourceDocumentId: session.source_document_id || null,
    target: { type: "licenta_session", id: session.id }
  };
}

export async function POST(request) {
  const context = await requireUser();
  if (context.error) {
    return context.error;
  }

  let payload = null;
  try {
    payload = await request.json();
  } catch {
    return jsonError("Datele atasarii nu au putut fi citite.");
  }

  const targetType = String(payload?.targetType || "");
  const targetId = String(payload?.targetId || "");
  const sourceDocumentId = String(payload?.sourceDocumentId || "");

  if (!TARGET_TYPES.has(targetType) || !targetId || !sourceDocumentId) {
    return jsonError("Alege un material valid si un fisier incarcat.");
  }

  const admin = createAdminClient();
  let sourceDocument = null;

  try {
    sourceDocument = await getOwnedSourceDocument({
      admin,
      userId: context.user.id,
      sourceDocumentId
    });

    const attachment =
      targetType === "question_bank"
        ? await attachToQuestionBank({
            admin,
            userId: context.user.id,
            targetId,
            sourceDocument
          })
        : await attachToLicentaSession({
            admin,
            userId: context.user.id,
            targetId,
            sourceDocument
          });

    const { error: sourceUpdateError } = await admin
      .from("ai_source_documents")
      .update({
        extraction_status: "succeeded",
        extraction_error: null
      })
      .eq("id", sourceDocument.id)
      .eq("user_id", context.user.id);

    if (sourceUpdateError) {
      throw sourceUpdateError;
    }

    return NextResponse.json({
      ok: true,
      sourceDocumentId: sourceDocument.id,
      sourceDocumentHref: `/api/source-documents/${sourceDocument.id}/open`,
      sourceDocumentName: sourceDocument.original_filename || "Fisier original",
      previousSourceDocumentId: attachment.previousSourceDocumentId,
      target: attachment.target
    });
  } catch (error) {
    await cleanupPendingDocument(admin, sourceDocument);
    const message = error instanceof Error ? error.message : "";
    const normalized = message.toLowerCase();
    const isSafeError = [
      "fisierul original nu a fost gasit",
      "uploadul fisierului nu a fost finalizat",
      "materialul nu a fost gasit",
      "licenta nu a fost gasita"
    ].some((part) => normalized.includes(part));

    return jsonError(
      isSafeError ? message : "Nu am putut atasa fisierul original. Incearca din nou.",
      isSafeError ? 400 : 500
    );
  }
}
