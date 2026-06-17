import "server-only";

import { buildLearningArtifactsFromText } from "@/lib/learning/study-set-generator";
import { createAdminClient } from "@/lib/supabase/admin";

function normalizeNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeText(value) {
  return String(value || "").trim();
}

function toJsonArray(value) {
  return Array.isArray(value) ? value : [];
}

function getCommunityTargets(academicContext) {
  const membership = academicContext?.membership || {};

  return {
    target_cohort_id: membership.cohort_id || null,
    target_unit_id: membership.program_unit_id || null,
    target_institution_id: membership.institution_id || null
  };
}

export async function createLearningStudySetFromText({
  userId,
  academicContext,
  title,
  text,
  examDate = null,
  minutesPerDay = 30,
  objective = ""
}) {
  const admin = createAdminClient();
  const artifacts = buildLearningArtifactsFromText({
    title,
    text,
    examDate,
    minutesPerDay,
    objective
  });
  const communityTargets = getCommunityTargets(academicContext);

  const { data: studySet, error: studySetError } = await admin
    .from("learning_study_sets")
    .insert({
      user_id: userId,
      title: artifacts.title,
      status: artifacts.status,
      source_kind: "text",
      source_excerpt: artifacts.sourceExcerpt,
      estimated_pages: artifacts.estimatedPages,
      chapter_count: artifacts.stats.chapterCount,
      concept_count: artifacts.stats.conceptCount,
      flashcard_count: artifacts.stats.flashcardCount,
      question_count: artifacts.stats.questionCount,
      recommended_level: artifacts.recommendedLevel,
      recommended_days: artifacts.recommendedDays,
      recommended_minutes_per_day: artifacts.recommendedMinutesPerDay,
      exam_date: examDate || null,
      objective: normalizeText(objective) || null,
      warnings: artifacts.warnings,
      metadata: {
        plan: artifacts.plan,
        generator: "local_text_mvp",
        processingMode: "standard"
      },
      ...communityTargets
    })
    .select("id")
    .single();

  if (studySetError) throw studySetError;

  for (const chapter of artifacts.chapters) {
    const { data: chapterRow, error: chapterError } = await admin
      .from("learning_chapters")
      .insert({
        study_set_id: studySet.id,
        position: chapter.position,
        title: chapter.title,
        summary: chapter.summary,
        key_ideas: chapter.keyIdeas,
        key_terms: chapter.keyTerms,
        source_hint: chapter.sourceHint,
        quality_status: chapter.qualityStatus,
        quality_notes: chapter.qualityNotes || null
      })
      .select("id")
      .single();

    if (chapterError) throw chapterError;

    const conceptRows = [];
    for (const concept of chapter.concepts) {
      const { data: conceptRow, error: conceptError } = await admin
        .from("learning_concepts")
        .insert({
          study_set_id: studySet.id,
          chapter_id: chapterRow.id,
          position: concept.position,
          title: concept.title,
          simple_explanation: concept.simpleExplanation,
          example: concept.example,
          analogy: concept.analogy,
          check_question: concept.checkQuestion,
          quality_status: chapter.qualityStatus
        })
        .select("id, position")
        .single();

      if (conceptError) throw conceptError;
      conceptRows.push(conceptRow);
    }

    const conceptIdByPosition = new Map(conceptRows.map((row) => [row.position, row.id]));

    if (chapter.flashcards.length) {
      const { error: flashcardError } = await admin.from("learning_flashcards").insert(
        chapter.flashcards.map((flashcard) => ({
          study_set_id: studySet.id,
          chapter_id: chapterRow.id,
          concept_id: conceptIdByPosition.get(flashcard.position) || null,
          position: flashcard.position,
          front: flashcard.front,
          back: flashcard.back,
          hint: flashcard.hint,
          quality_status: chapter.qualityStatus
        }))
      );

      if (flashcardError) throw flashcardError;
    }

    if (chapter.questions.length) {
      const { error: questionError } = await admin.from("learning_questions").insert(
        chapter.questions.map((question) => ({
          study_set_id: studySet.id,
          chapter_id: chapterRow.id,
          concept_id: conceptIdByPosition.get(question.position) || null,
          position: question.position,
          question_type: "multiple_choice",
          difficulty: question.difficulty,
          question_text: question.questionText,
          answers: question.answers,
          correct_index: question.correctIndex,
          explanation: question.explanation,
          quality_status: chapter.qualityStatus
        }))
      );

      if (questionError) throw questionError;
    }
  }

  return studySet.id;
}

export async function getLearningStudySetForUser({ studySetId, userId }) {
  const admin = createAdminClient();
  const { data: studySet, error: studySetError } = await admin
    .from("learning_study_sets")
    .select("*")
    .eq("id", studySetId)
    .eq("user_id", userId)
    .maybeSingle();

  if (studySetError) throw studySetError;
  if (!studySet) return null;

  const [
    { data: chapters, error: chaptersError },
    { data: concepts, error: conceptsError },
    { data: flashcards, error: flashcardsError },
    { data: questions, error: questionsError },
    { data: attempts, error: attemptsError }
  ] = await Promise.all([
    admin.from("learning_chapters").select("*").eq("study_set_id", studySetId).order("position"),
    admin.from("learning_concepts").select("*").eq("study_set_id", studySetId).order("position"),
    admin.from("learning_flashcards").select("*").eq("study_set_id", studySetId).order("position"),
    admin.from("learning_questions").select("*").eq("study_set_id", studySetId).order("position"),
    admin
      .from("learning_attempts")
      .select("*")
      .eq("study_set_id", studySetId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10)
  ]);

  if (chaptersError) throw chaptersError;
  if (conceptsError) throw conceptsError;
  if (flashcardsError) throw flashcardsError;
  if (questionsError) throw questionsError;
  if (attemptsError) throw attemptsError;

  return {
    id: studySet.id,
    title: studySet.title,
    status: studySet.status,
    sourceKind: studySet.source_kind,
    estimatedPages: normalizeNumber(studySet.estimated_pages, 0),
    chapterCount: normalizeNumber(studySet.chapter_count, 0),
    conceptCount: normalizeNumber(studySet.concept_count, 0),
    flashcardCount: normalizeNumber(studySet.flashcard_count, 0),
    questionCount: normalizeNumber(studySet.question_count, 0),
    recommendedLevel: studySet.recommended_level || "mediu",
    recommendedDays: normalizeNumber(studySet.recommended_days, 1),
    recommendedMinutesPerDay: normalizeNumber(studySet.recommended_minutes_per_day, 30),
    examDate: studySet.exam_date || null,
    objective: studySet.objective || "",
    warnings: toJsonArray(studySet.warnings),
    plan: toJsonArray(studySet.metadata?.plan),
    createdAt: studySet.created_at,
    updatedAt: studySet.updated_at,
    chapters: (chapters || []).map((chapter) => ({
      id: chapter.id,
      position: chapter.position,
      title: chapter.title,
      summary: chapter.summary || "",
      keyIdeas: toJsonArray(chapter.key_ideas),
      keyTerms: toJsonArray(chapter.key_terms),
      qualityStatus: chapter.quality_status,
      qualityNotes: chapter.quality_notes || "",
      concepts: (concepts || [])
        .filter((concept) => concept.chapter_id === chapter.id)
        .map((concept) => ({
          id: concept.id,
          title: concept.title,
          simpleExplanation: concept.simple_explanation || "",
          example: concept.example || "",
          analogy: concept.analogy || "",
          checkQuestion: concept.check_question || ""
        })),
      flashcards: (flashcards || [])
        .filter((flashcard) => flashcard.chapter_id === chapter.id)
        .map((flashcard) => ({
          id: flashcard.id,
          front: flashcard.front,
          back: flashcard.back,
          hint: flashcard.hint || ""
        })),
      questions: (questions || [])
        .filter((question) => question.chapter_id === chapter.id)
        .map((question) => ({
          id: question.id,
          questionText: question.question_text,
          answers: toJsonArray(question.answers),
          correctIndex: question.correct_index,
          explanation: question.explanation || "",
          difficulty: question.difficulty || "mediu"
        }))
    })),
    flashcards: (flashcards || []).map((flashcard) => ({
      id: flashcard.id,
      chapterId: flashcard.chapter_id,
      front: flashcard.front,
      back: flashcard.back,
      hint: flashcard.hint || ""
    })),
    questions: (questions || []).map((question) => ({
      id: question.id,
      chapterId: question.chapter_id,
      questionText: question.question_text,
      answers: toJsonArray(question.answers),
      correctIndex: question.correct_index,
      explanation: question.explanation || "",
      difficulty: question.difficulty || "mediu"
    })),
    attempts: attempts || []
  };
}

export async function getUserLearningStudySets(userId, limit = 8) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("learning_study_sets")
    .select(
      "id, title, status, estimated_pages, chapter_count, flashcard_count, question_count, recommended_days, updated_at, created_at"
    )
    .eq("user_id", userId)
    .neq("status", "archived")
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data || []).map((row) => ({
    id: row.id,
    title: row.title,
    status: row.status,
    estimatedPages: normalizeNumber(row.estimated_pages, 0),
    chapterCount: normalizeNumber(row.chapter_count, 0),
    flashcardCount: normalizeNumber(row.flashcard_count, 0),
    questionCount: normalizeNumber(row.question_count, 0),
    recommendedDays: normalizeNumber(row.recommended_days, 1),
    updatedAt: row.updated_at,
    createdAt: row.created_at
  }));
}
