"use server";

import { redirect } from "next/navigation";

import {
  getAcademicContext,
  getOnboardingHref,
  isAcademicContextComplete
} from "@/lib/academic/server";
import { getBillingSnapshot } from "@/lib/billing";
import { isDemoUser } from "@/lib/demo-user";
import { createLearningStudySetFromText } from "@/lib/learning/study-sets";
import { requireUser } from "@/lib/supabase/guards";

function redirectWithMessage(kind, message) {
  redirect(`/materiale/invata?${kind}=${encodeURIComponent(message)}`);
}

function parseMinutes(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 30;
  return Math.max(10, Math.min(240, Math.round(parsed)));
}

export async function createLearningStudySetAction(formData) {
  const user = await requireUser("/materiale/invata");

  if (isDemoUser(user)) {
    redirectWithMessage("error", "Procesarea reala este dezactivata in modul demo.");
  }

  const academicContext = await getAcademicContext(user.id);
  if (!isAcademicContextComplete(academicContext)) {
    redirect(getOnboardingHref("/materiale/invata"));
  }

  const title = String(formData.get("title") || "").trim();
  const manualText = String(formData.get("manualText") || "").trim();
  const objective = String(formData.get("objective") || "").trim();
  const examDate = String(formData.get("examDate") || "").trim() || null;
  const minutesPerDay = parseMinutes(formData.get("minutesPerDay"));

  if (manualText.length < 600) {
    redirectWithMessage(
      "error",
      "Textul este prea scurt. Lipeste cel putin cateva paragrafe ca sa putem construi materiale utile."
    );
  }

  if (examDate && Number.isNaN(new Date(examDate).getTime())) {
    redirectWithMessage("error", "Data examenului nu este valida.");
  }

  const billingSnapshot = await getBillingSnapshot(user.id);
  if (billingSnapshot.aiCredits < 1) {
    redirectWithMessage(
      "error",
      "Nu ai incarcari disponibile. Adauga incarcari si incearca din nou."
    );
  }

  let studySetId = null;
  try {
    studySetId = await createLearningStudySetFromText({
      userId: user.id,
      academicContext,
      title: title || "Materia mea",
      text: manualText,
      examDate,
      minutesPerDay,
      objective
    });
  } catch (error) {
    console.error("learning_study_set_create_failed", error);
    redirectWithMessage(
      "error",
      "Nu am putut pregati materia acum. Incearca din nou."
    );
  }

  redirect(`/materiale/invata/${studySetId}`);
}
