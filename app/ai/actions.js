"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  DeleteQuestionBankJobActivitySchema,
  DeleteQuestionBankUploadSchema,
  DeleteQuestionBankItemSchema,
  DeleteQuestionBanksSchema,
  DeleteQuestionBankSchema,
  DraftMetaFormSchema,
  DraftQuestionFormSchema,
  PublishDraftSchema,
  PublishQuestionBankSchema,
  QuestionBankReviewItemSchema
} from "@/lib/ai/schema";
import {
  buildPublishedDraftHref,
  buildPublishedQuestionBankHref
} from "@/lib/ai/published-destination";
import { deleteSourceDocumentObject } from "@/lib/ai/storage";
import { isDemoUser } from "@/lib/demo-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/supabase/guards";

function assertNotDemo(user) {
  if (isDemoUser(user)) {
    throw new Error("Modul demo nu permite editarea sau publicarea testelor private.");
  }
}

function readActionField(source, key) {
  if (source instanceof FormData) {
    return source.get(key);
  }

  return source?.[key];
}

function readActionValues(source, key) {
  if (source instanceof FormData) {
    return source.getAll(key);
  }

  return Array.isArray(source?.[key]) ? source[key] : [];
}

async function assertOwnedDraftTest(userId, testId) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("user_generated_tests")
    .select("id, status, subject_id")
    .eq("id", testId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error("Testul nu exista sau nu apartine utilizatorului curent.");
  }

  return data;
}

async function assertOwnedQuestionBank(userId, bankId) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ai_question_banks")
    .select("id, title, status, exam_type, subject_id, subject_name")
    .eq("id", bankId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error("Banca de intrebari nu exista sau nu apartine utilizatorului curent.");
  }

  return data;
}

async function assertOwnedQuestionBankJobActivity(userId, jobId) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ai_generation_jobs")
    .select("id, user_id, job_kind, status, metadata, result_bank_id")
    .eq("id", jobId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error("Intrarea din activitate nu exista sau nu apartine utilizatorului curent.");
  }

  return data;
}

async function reindexQuestionBankItems(supabase, bankId) {
  const { data: items, error } = await supabase
    .from("ai_question_bank_items")
    .select("id, position")
    .eq("bank_id", bankId)
    .order("position", { ascending: true })
    .order("id", { ascending: true });

  if (error) throw error;

  for (const [index, item] of (items || []).entries()) {
    const nextPosition = index + 1;
    if (item.position === nextPosition) {
      continue;
    }

    const { error: updateError } = await supabase
      .from("ai_question_bank_items")
      .update({ position: nextPosition })
      .eq("id", item.id)
      .eq("bank_id", bankId);

    if (updateError) throw updateError;
  }
}

function getPublishedBankMessage(bank) {
  if (bank.exam_type === "licenta") {
    return "Intrebarile sunt deja active in simularea de licenta.";
  }

  return "Intrebarile sunt deja active in aceasta materie.";
}

async function revalidateQuestionBankPaths(bank) {
  revalidatePath("/ai");
  revalidatePath("/materiale");
  revalidatePath("/ai/activitate");
  revalidatePath("/materiale/activitate");
  revalidatePath(`/ai/review/${bank.id}`);
  revalidatePath("/materii");
  revalidatePath("/licenta-exam");

  if (bank.subject_id && bank.subject_id !== "custom") {
    revalidatePath(`/materii/${bank.subject_id}`);
  }
}

async function markJobsActivityByRows(rows, { activityState, activityMessage, lastKnownSubjectLabel = null }) {
  if (!rows?.length) {
    return;
  }

  const supabase = createAdminClient();
  const activityAt = new Date().toISOString();

  for (const row of rows) {
    const nextMetadata = {
      ...(row.metadata || {}),
      activityState,
      activityMessage,
      activityAt,
      lastKnownSubjectLabel:
        lastKnownSubjectLabel || row.metadata?.lastKnownSubjectLabel || row.metadata?.subjectLabel || null
    };

    const { error } = await supabase
      .from("ai_generation_jobs")
      .update({
        metadata: nextMetadata,
        status_detail: activityMessage
      })
      .eq("id", row.id);

    if (error) throw error;
  }
}

async function markJobsActivityByBankId(bankId, payload) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ai_generation_jobs")
    .select("id, metadata")
    .eq("result_bank_id", bankId);

  if (error) throw error;
  await markJobsActivityByRows(data || [], payload);
}

async function markQuestionBankJobsDeleted(supabase, userId, banks) {
  const bankIdSet = new Set(banks.map((bank) => bank.id).filter(Boolean));
  if (!bankIdSet.size) {
    return;
  }

  const subjectLabelByBankId = new Map(
    banks.map((bank) => [bank.id, bank.subject_name || null])
  );
  const { data: rows, error } = await supabase
    .from("ai_generation_jobs")
    .select("id, status, completed_at, metadata, result_bank_id")
    .eq("user_id", userId)
    .in("result_bank_id", [...bankIdSet]);

  if (error) throw error;
  if (!rows?.length) {
    return;
  }

  const deletedAt = new Date().toISOString();
  for (const row of rows) {
    const metadata = row.metadata || {};
    const activityMessage = "Fisierul a fost sters.";
    const nextMetadata = {
      ...metadata,
      activityState: "deleted",
      activityMessage,
      activityAt: deletedAt,
      lastKnownSubjectLabel:
        subjectLabelByBankId.get(row.result_bank_id) ||
        metadata.lastKnownSubjectLabel ||
        metadata.subjectLabel ||
        null
    };
    const shouldStopJob = row.status === "pending" || row.status === "processing" || row.status === "failed";

    const { error: updateError } = await supabase
      .from("ai_generation_jobs")
      .update({
        status: shouldStopJob ? "failed" : row.status,
        stage: "deleted",
        progress_percent: 100,
        status_detail: activityMessage,
        error_message: null,
        completed_at: row.completed_at || deletedAt,
        locked_at: null,
        result_bank_id: null,
        source_document_id: null,
        metadata: nextMetadata
      })
      .eq("id", row.id)
      .eq("user_id", userId);

    if (updateError) throw updateError;
  }
}

function getNormalSubjectIdsFromBanks(banks) {
  return [
    ...new Set(
      banks
        .filter((bank) => bank.exam_type !== "licenta")
        .map((bank) => bank.subject_id)
        .filter((subjectId) => subjectId && subjectId !== "custom")
    )
  ];
}

async function expandQuestionBanksBySelectedSubjects(supabase, userId, selectedBanks) {
  const subjectIds = getNormalSubjectIdsFromBanks(selectedBanks);
  if (!subjectIds.length) {
    return selectedBanks;
  }

  const { data: subjectBanks, error } = await supabase
    .from("ai_question_banks")
    .select("id, title, status, exam_type, subject_id, subject_name, source_document_id")
    .eq("user_id", userId)
    .neq("exam_type", "licenta")
    .neq("status", "archived")
    .in("subject_id", subjectIds);

  if (error) throw error;

  const bankMap = new Map(selectedBanks.map((bank) => [bank.id, bank]));
  for (const bank of subjectBanks || []) {
    bankMap.set(bank.id, bank);
  }

  return Array.from(bankMap.values());
}

async function deleteUnusedUserSubjectCatalogEntries(supabase, userId, deletedBanks) {
  const subjectIds = getNormalSubjectIdsFromBanks(deletedBanks);
  if (!subjectIds.length) {
    return;
  }

  const [
    { data: remainingBanks, error: remainingBanksError },
    { data: remainingTests, error: remainingTestsError }
  ] = await Promise.all([
    supabase
      .from("ai_question_banks")
      .select("subject_id")
      .neq("status", "archived")
      .in("subject_id", subjectIds),
    supabase
      .from("user_generated_tests")
      .select("subject_id")
      .neq("status", "archived")
      .in("subject_id", subjectIds)
  ]);

  if (remainingBanksError) throw remainingBanksError;
  if (remainingTestsError) throw remainingTestsError;

  const stillUsedSubjectIds = new Set([
    ...(remainingBanks || []).map((row) => row.subject_id),
    ...(remainingTests || []).map((row) => row.subject_id)
  ].filter(Boolean));
  const unusedSubjectIds = subjectIds.filter((subjectId) => !stillUsedSubjectIds.has(subjectId));
  if (!unusedSubjectIds.length) {
    return;
  }

  const { error: allocationDeleteError } = await supabase
    .from("subject_allocations")
    .delete()
    .eq("created_by", userId)
    .in("subject_id", unusedSubjectIds);

  if (allocationDeleteError) throw allocationDeleteError;

  const { data: remainingAllocations, error: remainingAllocationsError } = await supabase
    .from("subject_allocations")
    .select("subject_id")
    .in("subject_id", unusedSubjectIds);

  if (remainingAllocationsError) throw remainingAllocationsError;

  const subjectIdsWithAllocations = new Set(
    (remainingAllocations || []).map((row) => row.subject_id).filter(Boolean)
  );
  const removableSubjectIds = unusedSubjectIds.filter(
    (subjectId) => !subjectIdsWithAllocations.has(subjectId)
  );

  if (!removableSubjectIds.length) {
    return;
  }

  const { error: subjectDeleteError } = await supabase
    .from("subjects")
    .delete()
    .eq("created_by", userId)
    .eq("source", "user")
    .in("id", removableSubjectIds);

  if (subjectDeleteError) throw subjectDeleteError;
}

async function deleteUnusedSourceDocumentsForUser(supabase, userId, sourceDocumentIds) {
  const uniqueIds = [...new Set(sourceDocumentIds)].filter(Boolean);
  if (!uniqueIds.length) {
    return;
  }

  const [
    { data: sourceDocuments, error: sourceDocumentsError },
    { data: bankRefs, error: bankRefsError },
    { data: testRefs, error: testRefsError },
    { data: generationJobRefs, error: generationJobRefsError },
    { data: importJobRefs, error: importJobRefsError }
  ] = await Promise.all([
    supabase
      .from("ai_source_documents")
      .select("id, storage_bucket, storage_path")
      .eq("user_id", userId)
      .in("id", uniqueIds),
    supabase
      .from("ai_question_banks")
      .select("source_document_id")
      .eq("user_id", userId)
      .in("source_document_id", uniqueIds),
    supabase
      .from("user_generated_tests")
      .select("source_document_id")
      .eq("user_id", userId)
      .in("source_document_id", uniqueIds),
    supabase
      .from("ai_generation_jobs")
      .select("source_document_id")
      .eq("user_id", userId)
      .in("source_document_id", uniqueIds),
    supabase
      .from("ai_import_jobs")
      .select("source_document_id")
      .eq("user_id", userId)
      .in("source_document_id", uniqueIds)
  ]);

  if (sourceDocumentsError) throw sourceDocumentsError;
  if (bankRefsError) throw bankRefsError;
  if (testRefsError) throw testRefsError;
  if (generationJobRefsError) throw generationJobRefsError;
  if (importJobRefsError) throw importJobRefsError;

  const referencedIds = new Set([
    ...(bankRefs || []).map((row) => row.source_document_id),
    ...(testRefs || []).map((row) => row.source_document_id),
    ...(generationJobRefs || []).map((row) => row.source_document_id),
    ...(importJobRefs || []).map((row) => row.source_document_id)
  ].filter(Boolean));

  const unusedDocuments = (sourceDocuments || []).filter((document) => !referencedIds.has(document.id));
  for (const document of unusedDocuments) {
    try {
      await deleteSourceDocumentObject({
        storageBucket: document.storage_bucket,
        storagePath: document.storage_path
      });
    } catch (error) {
      console.warn("Nu am putut sterge fisierul sursa din storage.", {
        sourceDocumentId: document.id,
        message: error instanceof Error ? error.message : String(error)
      });
    }

    const { error: deleteDocumentError } = await supabase
      .from("ai_source_documents")
      .delete()
      .eq("id", document.id)
      .eq("user_id", userId);

    if (deleteDocumentError) throw deleteDocumentError;
  }
}

export async function updateDraftMetaAction(formData) {
  const user = await requireUser("/materiale");
  assertNotDemo(user);
  const parsed = DraftMetaFormSchema.parse({
    testId: formData.get("testId"),
    title: formData.get("title")
  });

  const test = await assertOwnedDraftTest(user.id, parsed.testId);

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("user_generated_tests")
    .update({
      title: parsed.title
    })
    .eq("id", parsed.testId)
    .eq("user_id", user.id);

  if (error) throw error;

  revalidatePath(`/ai/drafts/${parsed.testId}`);
}

export async function updateDraftQuestionAction(formData) {
  const user = await requireUser("/materiale");
  assertNotDemo(user);
  const parsed = DraftQuestionFormSchema.parse({
    questionId: formData.get("questionId"),
    testId: formData.get("testId"),
    questionText: formData.get("questionText"),
    answerA: formData.get("answerA"),
    answerB: formData.get("answerB"),
    answerC: formData.get("answerC"),
    answerD: formData.get("answerD"),
    correctIndex: formData.get("correctIndex"),
    explanation: formData.get("explanation") || ""
  });

  await assertOwnedDraftTest(user.id, parsed.testId);

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("user_generated_test_questions")
    .update({
      question_text: parsed.questionText,
      answers: [parsed.answerA, parsed.answerB, parsed.answerC, parsed.answerD],
      correct_index: parsed.correctIndex,
      explanation: parsed.explanation
    })
    .eq("id", parsed.questionId)
    .eq("user_id", user.id);

  if (error) throw error;

  revalidatePath(`/ai/drafts/${parsed.testId}`);
}

export async function publishDraftAction(formData) {
  const user = await requireUser("/materiale");
  assertNotDemo(user);
  const parsed = PublishDraftSchema.parse({
    testId: formData.get("testId")
  });

  await assertOwnedDraftTest(user.id, parsed.testId);

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("user_generated_tests")
    .update({
      status: "active",
      published_at: new Date().toISOString()
    })
    .eq("id", parsed.testId)
    .eq("user_id", user.id);

  if (error) throw error;

  revalidatePath("/ai");
  revalidatePath(`/ai/drafts/${parsed.testId}`);
  revalidatePath("/materii");
  if (test.subject_id && test.subject_id !== "custom") {
    revalidatePath(`/materii/${test.subject_id}`);
  }
  redirect(buildPublishedDraftHref(test));
}

export async function updateQuestionBankItemAction(formData) {
  const user = await requireUser("/materiale");
  assertNotDemo(user);
  const answers = readActionValues(formData, "answers").map((value) => String(value || ""));
  const parsed = QuestionBankReviewItemSchema.parse({
    bankId: readActionField(formData, "bankId"),
    itemId: readActionField(formData, "itemId"),
    questionText: readActionField(formData, "questionText"),
    answers,
    correctIndex: readActionField(formData, "correctIndex"),
    explanation: readActionField(formData, "explanation") || "",
    resolvedNeedsReview: readActionField(formData, "resolvedNeedsReview") || false
  });

  const bank = await assertOwnedQuestionBank(user.id, parsed.bankId);

  const supabase = createAdminClient();
  const { data: currentItem, error: currentItemError } = await supabase
    .from("ai_question_bank_items")
    .select("id, quality_status, metadata")
    .eq("id", parsed.itemId)
    .eq("bank_id", parsed.bankId)
    .maybeSingle();

  if (currentItemError) throw currentItemError;
  if (!currentItem) {
    throw new Error("Intrebarea nu exista in aceasta banca.");
  }

  if (bank.exam_type === "licenta" && currentItem.quality_status === "needs_review" && !parsed.resolvedNeedsReview) {
    throw new Error("Confirma ca ai completat manual ce lipsea inainte sa salvezi intrebarea.");
  }

  const { error } = await supabase
    .from("ai_question_bank_items")
    .update({
      question_text: parsed.questionText,
      answers: parsed.answers,
      correct_index: parsed.correctIndex,
      explanation: parsed.explanation,
      quality_status: "accepted",
      metadata: {
        ...(currentItem.metadata || {}),
        review_resolved_at: new Date().toISOString(),
        review_resolved_manually: currentItem.quality_status === "needs_review"
      }
    })
    .eq("id", parsed.itemId)
    .eq("bank_id", parsed.bankId);

  if (error) throw error;

  await markJobsActivityByBankId(parsed.bankId, {
    activityState: "modified",
    activityMessage: "Intrebarile au fost modificate.",
    lastKnownSubjectLabel: bank.subject_name || null
  });
  await revalidateQuestionBankPaths(bank);
  return {
    ok: true,
    message: "Intrebarea a fost salvata.",
    item: {
      id: parsed.itemId,
      position: typeof formData?.position === "number" ? formData.position : null,
      question_text: parsed.questionText,
      answers: parsed.answers,
      correct_index: parsed.correctIndex,
      explanation: parsed.explanation
    }
  };
}

export async function deleteQuestionBankItemAction(formData) {
  const user = await requireUser("/materiale");
  assertNotDemo(user);
  const parsed = DeleteQuestionBankItemSchema.parse({
    bankId: readActionField(formData, "bankId"),
    itemId: readActionField(formData, "itemId")
  });

  const bank = await assertOwnedQuestionBank(user.id, parsed.bankId);
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("ai_question_bank_items")
    .delete()
    .eq("id", parsed.itemId)
    .eq("bank_id", parsed.bankId);

  if (error) throw error;

  await reindexQuestionBankItems(supabase, parsed.bankId);
  await markJobsActivityByBankId(parsed.bankId, {
    activityState: "modified",
    activityMessage: "Intrebarile au fost modificate.",
    lastKnownSubjectLabel: bank.subject_name || null
  });
  await revalidateQuestionBankPaths(bank);
  return {
    ok: true,
    message: "Intrebarea a fost stearsa."
  };
}

export async function publishQuestionBankAction(formData) {
  const user = await requireUser("/materiale");
  assertNotDemo(user);
  const parsed = PublishQuestionBankSchema.parse({
    bankId: formData.get("bankId")
  });

  const bank = await assertOwnedQuestionBank(user.id, parsed.bankId);

  const supabase = createAdminClient();
  if (bank.exam_type === "licenta") {
    const { count: unresolvedCount, error: unresolvedError } = await supabase
      .from("ai_question_bank_items")
      .select("id", { count: "exact", head: true })
      .eq("bank_id", parsed.bankId)
      .eq("quality_status", "needs_review");

    if (unresolvedError) throw unresolvedError;
    if ((unresolvedCount || 0) > 0) {
      throw new Error(
        `Nu poti publica licenta inca. Rezolva cele ${unresolvedCount} intrebari marcate cu atentie.`
      );
    }
  }

  const publishedAt = new Date().toISOString();

  const { error: bankError } = await supabase
    .from("ai_question_banks")
    .update({
      status: "published",
      published_at: publishedAt
    })
    .eq("id", parsed.bankId)
    .eq("user_id", user.id);

  if (bankError) throw bankError;

  const { error: jobError } = await supabase
    .from("ai_generation_jobs")
    .update({
      stage: "completed",
      status_detail: getPublishedBankMessage(bank)
    })
    .eq("result_bank_id", parsed.bankId)
    .eq("user_id", user.id);

  if (jobError) throw jobError;

  await markJobsActivityByBankId(parsed.bankId, {
    activityState: "published",
    activityMessage: getPublishedBankMessage(bank),
    lastKnownSubjectLabel: bank.subject_name || null
  });
  await revalidateQuestionBankPaths(bank);
  redirect(buildPublishedQuestionBankHref(bank));
}

export async function deleteQuestionBankAction(formData) {
  const user = await requireUser("/materiale");
  assertNotDemo(user);
  const parsed = DeleteQuestionBankSchema.parse({
    bankId: readActionField(formData, "bankId")
  });

  const result = await deleteQuestionBanksForUser(user.id, [parsed.bankId]);

  return {
    ok: true,
    deletedIds: result.deletedIds,
    redirectTo: `/materiale?message=${encodeURIComponent("Fisierul a fost sters.")}`
  };
}

export async function deleteQuestionBanksAction(formData) {
  const user = await requireUser("/materiale");
  assertNotDemo(user);
  const parsed = DeleteQuestionBanksSchema.parse({
    bankIds: readActionValues(formData, "bankIds")
  });

  const result = await deleteQuestionBanksForUser(user.id, parsed.bankIds);

  return {
    ok: true,
    deletedIds: result.deletedIds,
    message:
      result.deletedIds.length === 1
        ? "Materialul a fost sters."
        : `${result.deletedIds.length} materiale au fost sterse.`
  };
}

async function deleteQuestionBanksForUser(userId, bankIds) {
  const supabase = createAdminClient();
  const uniqueBankIds = [...new Set(bankIds)].filter(Boolean);

  const { data: selectedBanks, error: banksError } = await supabase
    .from("ai_question_banks")
    .select("id, title, status, exam_type, subject_id, subject_name, source_document_id")
    .eq("user_id", userId)
    .in("id", uniqueBankIds);

  if (banksError) throw banksError;
  if (!selectedBanks?.length) {
    throw new Error("Nu am gasit materialele selectate pentru acest cont.");
  }

  const banks = await expandQuestionBanksBySelectedSubjects(supabase, userId, selectedBanks);
  const bankIdSet = banks.map((bank) => bank.id);
  const sourceDocumentIds = banks.map((bank) => bank.source_document_id).filter(Boolean);

  await markQuestionBankJobsDeleted(supabase, userId, banks);

  const { error: clearGenerationJobsError } = await supabase
    .from("ai_generation_jobs")
    .update({ result_bank_id: null, source_document_id: null })
    .eq("user_id", userId)
    .in("result_bank_id", bankIdSet);

  if (clearGenerationJobsError) throw clearGenerationJobsError;

  const { error: clearImportJobsError } = await supabase
    .from("ai_import_jobs")
    .update({ result_bank_id: null, source_document_id: null })
    .eq("user_id", userId)
    .in("result_bank_id", bankIdSet);

  if (clearImportJobsError) throw clearImportJobsError;

  const { error: clearLicentaSessionsError } = await supabase
    .from("ai_licenta_import_sessions")
    .update({ result_bank_id: null })
    .eq("user_id", userId)
    .in("result_bank_id", bankIdSet);

  if (clearLicentaSessionsError) throw clearLicentaSessionsError;

  const { error: deleteItemsError } = await supabase
    .from("ai_question_bank_items")
    .delete()
    .in("bank_id", bankIdSet);

  if (deleteItemsError) throw deleteItemsError;

  const { data: deletedBanks, error: deleteBanksError } = await supabase
    .from("ai_question_banks")
    .delete()
    .eq("user_id", userId)
    .in("id", bankIdSet)
    .select("id");

  if (deleteBanksError) throw deleteBanksError;
  const deletedIds = new Set((deletedBanks || []).map((bank) => bank.id));

  if (deletedIds.size !== bankIdSet.length) {
    throw new Error("Nu toate materialele selectate au putut fi sterse.");
  }

  const { data: remainingBanks, error: remainingBanksError } = await supabase
    .from("ai_question_banks")
    .select("id")
    .eq("user_id", userId)
    .in("id", bankIdSet);

  if (remainingBanksError) throw remainingBanksError;
  if ((remainingBanks || []).length) {
    throw new Error("Unele materiale inca exista in baza de date dupa stergere.");
  }

  await deleteUnusedUserSubjectCatalogEntries(supabase, userId, banks);
  await deleteUnusedSourceDocumentsForUser(supabase, userId, sourceDocumentIds);

  for (const bank of banks) {
    await revalidateQuestionBankPaths(bank);
  }

  return {
    deletedIds: bankIdSet.filter((bankId) => deletedIds.has(bankId))
  };
}

export async function deleteQuestionBankJobActivityAction(formData) {
  const user = await requireUser("/materiale");
  assertNotDemo(user);
  const parsed = DeleteQuestionBankJobActivitySchema.parse({
    jobId: readActionField(formData, "jobId")
  });

  const job = await assertOwnedQuestionBankJobActivity(user.id, parsed.jobId);
  const activityState = job.metadata?.activityState || null;

  if (job.job_kind !== "question_bank_extract") {
    throw new Error("Aceasta intrare nu poate fi stearsa de aici.");
  }

  if (activityState !== "deleted") {
    throw new Error("Poti sterge doar intrarile care sunt deja marcate ca sterse.");
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("ai_generation_jobs")
    .delete()
    .eq("id", parsed.jobId)
    .eq("user_id", user.id)
    .eq("job_kind", "question_bank_extract");

  if (error) throw error;

  revalidatePath("/ai");
  return {
    ok: true,
    message: "Intrarea a fost stearsa."
  };
}

export async function deleteQuestionBankUploadAction(formData) {
  const user = await requireUser("/materiale");
  assertNotDemo(user);
  const parsed = DeleteQuestionBankUploadSchema.parse({
    jobId: readActionField(formData, "jobId")
  });

  const supabase = createAdminClient();
  const { data: job, error: jobError } = await supabase
    .from("ai_generation_jobs")
    .select("id, user_id, job_kind, result_bank_id, metadata")
    .eq("id", parsed.jobId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (jobError) throw jobError;

  if (!job) {
    revalidatePath("/ai");
    return {
      ok: true,
      redirectTo: `/materiale?message=${encodeURIComponent("Fisierul a fost sters.")}`
    };
  }

  if (job.job_kind !== "question_bank_extract") {
    throw new Error("Acest fisier nu poate fi sters de aici.");
  }

  if (job.result_bank_id) {
    const { data: bank, error: bankError } = await supabase
      .from("ai_question_banks")
      .select("id, status, subject_id")
      .eq("id", job.result_bank_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (bankError) throw bankError;

    if (bank?.status === "published") {
      throw new Error("Acest fisier este deja publicat si nu poate fi sters de aici.");
    }

    if (bank) {
      const { error: deleteBankError } = await supabase
        .from("ai_question_banks")
        .delete()
        .eq("id", bank.id)
        .eq("user_id", user.id);

      if (deleteBankError) throw deleteBankError;

      revalidatePath(`/ai/review/${bank.id}`);
      if (bank.subject_id && bank.subject_id !== "custom") {
        revalidatePath(`/materii/${bank.subject_id}`);
      }
    }
  }

  const { error: deleteJobError } = await supabase
    .from("ai_generation_jobs")
    .delete()
    .eq("id", parsed.jobId)
    .eq("user_id", user.id)
    .eq("job_kind", "question_bank_extract");

  if (deleteJobError) throw deleteJobError;

  revalidatePath("/ai");
  revalidatePath("/materii");
  revalidatePath("/licenta-exam");

  return {
    ok: true,
    redirectTo: `/materiale?message=${encodeURIComponent("Fisierul a fost sters.")}`
  };
}
