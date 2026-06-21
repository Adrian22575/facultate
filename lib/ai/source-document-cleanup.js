import "server-only";

import { deleteSourceDocumentObject } from "@/lib/ai/storage";

export async function cleanupUnusedSourceDocumentsForUser(admin, userId, sourceDocumentIds) {
  const uniqueIds = [...new Set(sourceDocumentIds || [])].filter(Boolean);
  if (!userId || !uniqueIds.length) {
    return { deletedIds: [], pendingIds: [] };
  }

  const [
    { data: sourceDocuments, error: sourceDocumentsError },
    { data: bankRefs, error: bankRefsError },
    { data: testRefs, error: testRefsError },
    { data: generationJobRefs, error: generationJobRefsError },
    { data: importJobRefs, error: importJobRefsError },
    { data: learningSetRefs, error: learningSetRefsError }
  ] = await Promise.all([
    admin
      .from("ai_source_documents")
      .select("id, storage_bucket, storage_path")
      .eq("user_id", userId)
      .in("id", uniqueIds),
    admin.from("ai_question_banks").select("source_document_id").eq("user_id", userId).in("source_document_id", uniqueIds),
    admin.from("user_generated_tests").select("source_document_id").eq("user_id", userId).in("source_document_id", uniqueIds),
    admin.from("ai_generation_jobs").select("source_document_id").eq("user_id", userId).in("source_document_id", uniqueIds),
    admin.from("ai_import_jobs").select("source_document_id").eq("user_id", userId).in("source_document_id", uniqueIds),
    admin.from("learning_study_sets").select("source_document_id").eq("user_id", userId).in("source_document_id", uniqueIds)
  ]);

  const readError = [
    sourceDocumentsError,
    bankRefsError,
    testRefsError,
    generationJobRefsError,
    importJobRefsError,
    learningSetRefsError
  ].find(Boolean);
  if (readError) throw readError;

  const referencedIds = new Set(
    [bankRefs, testRefs, generationJobRefs, importJobRefs, learningSetRefs]
      .flatMap((rows) => (rows || []).map((row) => row.source_document_id))
      .filter(Boolean)
  );
  const deletedIds = [];
  const pendingIds = [];

  for (const document of sourceDocuments || []) {
    if (referencedIds.has(document.id)) continue;

    try {
      await deleteSourceDocumentObject({
        storageBucket: document.storage_bucket,
        storagePath: document.storage_path
      });
    } catch (error) {
      pendingIds.push(document.id);
      console.warn("source_document_storage_cleanup_pending", {
        sourceDocumentId: document.id,
        message: error instanceof Error ? error.message : String(error)
      });
      continue;
    }

    const { error: deleteDocumentError } = await admin
      .from("ai_source_documents")
      .delete()
      .eq("id", document.id)
      .eq("user_id", userId);
    if (deleteDocumentError) throw deleteDocumentError;
    deletedIds.push(document.id);
  }

  return { deletedIds, pendingIds };
}
