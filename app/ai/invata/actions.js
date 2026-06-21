"use server";

import { revalidatePath } from "next/cache";

import { getAcademicContext } from "@/lib/academic/server";
import { isDemoUser } from "@/lib/demo-user";
import {
  deleteOwnedLearningStudySet,
  publishLearningStudySetToCommunity,
  reportLearningStudySet,
  retryFailedLearningStudySet,
  saveLearningFlashcardRating,
  saveLearningQuizAttempt
} from "@/lib/learning/study-sets";
import { requireUser } from "@/lib/supabase/guards";
import { getLearningSetupErrorMessage } from "@/lib/supabase/setup-status";

export async function saveLearningFlashcardRatingAction(payload) {
  const studySetId = String(payload?.studySetId || "").trim();
  const flashcardId = String(payload?.flashcardId || "").trim();
  const rating = String(payload?.rating || "").trim();
  const user = await requireUser(studySetId ? `/materiale/invata/${studySetId}` : "/materiale/invata");

  if (isDemoUser(user)) {
    return { ok: false, error: "Progresul real nu este activ in modul demo." };
  }

  if (!studySetId || !flashcardId || !rating) {
    return { ok: false, error: "Nu am putut salva ratingul." };
  }

  try {
    const academicContext = await getAcademicContext(user.id);
    const review = await saveLearningFlashcardRating({
      userId: user.id,
      studySetId,
      flashcardId,
      rating,
      academicContext
    });
    revalidatePath(`/materiale/invata/${studySetId}`);
    return { ok: true, review };
  } catch (error) {
    console.error("learning_flashcard_rating_save_failed", error);
    return { ok: false, error: getLearningSetupErrorMessage(error) || "Nu am putut salva ratingul acum." };
  }
}

export async function saveLearningQuizAttemptAction(payload) {
  const studySetId = String(payload?.studySetId || "").trim();
  const chapterId = String(payload?.chapterId || "all").trim() || "all";
  const idempotencyKey = String(payload?.idempotencyKey || "").trim();
  const answers = Array.isArray(payload?.answers) ? payload.answers : [];
  const user = await requireUser(studySetId ? `/materiale/invata/${studySetId}` : "/materiale/invata");

  if (isDemoUser(user)) {
    return { ok: false, error: "Progresul real nu este activ in modul demo." };
  }

  if (!studySetId || !idempotencyKey || !answers.length) {
    return { ok: false, error: "Nu am putut salva rezultatul testului." };
  }

  try {
    const academicContext = await getAcademicContext(user.id);
    const result = await saveLearningQuizAttempt({
      userId: user.id,
      studySetId,
      chapterId,
      idempotencyKey,
      answers,
      academicContext
    });
    revalidatePath(`/materiale/invata/${studySetId}`);
    return { ok: true, result };
  } catch (error) {
    console.error("learning_quiz_attempt_save_failed", error);
    return { ok: false, error: getLearningSetupErrorMessage(error) || "Nu am putut salva rezultatul testului acum." };
  }
}

export async function publishLearningStudySetAction(payload) {
  const studySetId = String(payload?.studySetId || "").trim();
  const user = await requireUser(studySetId ? `/materiale/invata/${studySetId}` : "/materiale/invata");

  if (isDemoUser(user)) {
    return { ok: false, error: "Publicarea nu este activa in modul demo." };
  }

  if (!studySetId) {
    return { ok: false, error: "Nu am putut identifica materialul." };
  }

  try {
    const academicContext = await getAcademicContext(user.id);
    const result = await publishLearningStudySetToCommunity({
      userId: user.id,
      academicContext,
      studySetId
    });
    revalidatePath(`/materiale/invata/${studySetId}`);
    revalidatePath("/materiale/invata");
    return { ok: true, result };
  } catch (error) {
    console.error("learning_study_set_publish_failed", error);
    return {
      ok: false,
      error: getLearningSetupErrorMessage(error) || (error instanceof Error ? error.message : "Nu am putut publica materialul acum.")
    };
  }
}

export async function reportLearningStudySetAction(payload) {
  const studySetId = String(payload?.studySetId || "").trim();
  const reason = String(payload?.reason || "content_issue").trim();
  const detail = String(payload?.detail || "").trim();
  const user = await requireUser(studySetId ? `/materiale/invata/${studySetId}` : "/materiale/invata");

  if (isDemoUser(user)) {
    return { ok: false, error: "Raportarea nu este activa in modul demo." };
  }

  if (!studySetId) {
    return { ok: false, error: "Nu am putut identifica materialul." };
  }

  try {
    const academicContext = await getAcademicContext(user.id);
    const result = await reportLearningStudySet({
      userId: user.id,
      academicContext,
      studySetId,
      reason,
      detail
    });
    return { ok: true, result };
  } catch (error) {
    console.error("learning_study_set_report_failed", error);
    return { ok: false, error: getLearningSetupErrorMessage(error) || "Nu am putut trimite raportarea acum." };
  }
}

export async function retryLearningStudySetAction(payload) {
  const studySetId = String(payload?.studySetId || "").trim();
  const user = await requireUser(studySetId ? `/materiale/invata/${studySetId}` : "/materiale/invata");

  if (isDemoUser(user)) {
    return { ok: false, error: "Retry-ul nu este activ in modul demo." };
  }

  if (!studySetId) {
    return { ok: false, error: "Nu am putut identifica materialul." };
  }

  try {
    const academicContext = await getAcademicContext(user.id);
    const result = await retryFailedLearningStudySet({
      userId: user.id,
      studySetId,
      academicContext
    });
    revalidatePath(`/materiale/invata/${studySetId}`);
    revalidatePath("/materiale/invata");
    return { ok: true, result };
  } catch (error) {
    console.error("learning_study_set_retry_failed", error);
    return {
      ok: false,
      error: getLearningSetupErrorMessage(error) ||
        (error instanceof Error ? error.message : "Nu am putut relua procesarea acum.")
    };
  }
}

export async function deleteLearningStudySetAction(payload) {
  const studySetId = String(payload?.studySetId || "").trim();
  const user = await requireUser(studySetId ? `/materiale/invata/${studySetId}` : "/materiale/invata");

  if (isDemoUser(user)) {
    return { ok: false, error: "Stergerea nu este activa in modul demo." };
  }

  if (!studySetId) {
    return { ok: false, error: "Nu am putut identifica materialul." };
  }

  try {
    const result = await deleteOwnedLearningStudySet({ userId: user.id, studySetId });
    revalidatePath("/materiale/invata");
    revalidatePath("/materiale");
    return { ok: true, result };
  } catch (error) {
    console.error("learning_study_set_delete_failed", error);
    return {
      ok: false,
      error:
        getLearningSetupErrorMessage(error) ||
        (error instanceof Error ? error.message : "Nu am putut sterge materialul acum.")
    };
  }
}
