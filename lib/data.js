import { promises as fs } from "fs";
import path from "path";

import { getSupabaseServerEnv } from "@/lib/env/server";
import { canAccessPublishedBank } from "@/lib/question-access";
import { applyUserQuestionCorrections, buildQuestionCorrectionMeta } from "@/lib/question-corrections";
import { normalizeQuestions } from "@/lib/quiz";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseSetupIncompleteError } from "@/lib/supabase/setup-status";
const LICENTA_GENERAL_ID = "licenta-generala";
const LICENTA_GENERAL_LABEL = "Licenta generala";
const LOCAL_SUBJECTS_FILE = path.join(process.cwd(), "data", "subjects.json");

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

function normalizeText(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function sortSubjects(subjects) {
  return [...subjects].sort((left, right) => left.title.localeCompare(right.title, "ro"));
}

function createSubjectSlug(title) {
  return normalizeText(title)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function buildUniqueSubjectId(subjects, title) {
  const baseId = createSubjectSlug(title) || "materie";
  const usedIds = new Set(subjects.map((subject) => subject.id));

  if (!usedIds.has(baseId)) {
    return baseId;
  }

  let index = 2;
  while (usedIds.has(`${baseId}-${index}`)) {
    index += 1;
  }

  return `${baseId}-${index}`;
}

function normalizeSchoolClassLabel(value) {
  return value.trim().replace(/\s+/g, " ");
}

function buildAllocationKey({ subjectId, userType, studyYear, semester, schoolClass }) {
  return [
    subjectId,
    userType,
    studyYear ?? "",
    semester ?? "",
    schoolClass ? normalizeText(schoolClass) : ""
  ].join("::");
}

function mapSupabaseSubject(row) {
  return {
    id: row.id,
    title: row.title,
    questionsFile: row.questions_file || null
  };
}

function mapLocalSubject(row) {
  return {
    id: row.id,
    title: row.title,
    questionsFile: row.questionsFile || null
  };
}

async function readLocalSubjects() {
  try {
    const payload = await readJson(LOCAL_SUBJECTS_FILE);
    return Array.isArray(payload.subjects) ? payload.subjects.map(mapLocalSubject) : [];
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

function mergeLocalSubjectCatalog(subjects, localSubjects) {
  const localById = new Map(localSubjects.map((subject) => [subject.id, subject]));
  const seenSubjectIds = new Set();

  const mergedSubjects = subjects.map((subject) => {
    seenSubjectIds.add(subject.id);
    const localSubject = localById.get(subject.id);

    if (!localSubject) {
      return subject;
    }

    return {
      ...subject,
      title: subject.title || localSubject.title,
      questionsFile: subject.questionsFile || localSubject.questionsFile
    };
  });

  for (const localSubject of localSubjects) {
    if (!seenSubjectIds.has(localSubject.id)) {
      mergedSubjects.push(localSubject);
    }
  }

  return mergedSubjects;
}

function mapSupabaseAllocation(row) {
  return {
    subjectId: row.subject_id,
    userType: row.user_type === "elev" ? "elev" : "student",
    studyYear: typeof row.study_year === "number" ? row.study_year : null,
    semester: typeof row.semester === "number" ? row.semester : null,
    schoolClass:
      typeof row.school_class === "string" && row.school_class.trim().length
        ? normalizeSchoolClassLabel(row.school_class)
        : null
  };
}

function isUsableSubjectId(subjectId) {
  return typeof subjectId === "string" && subjectId.trim().length > 0 && subjectId !== "custom";
}

function mapBankAllocation(bank, userType) {
  const semester = Number(bank.semester);
  if (![1, 2].includes(semester)) {
    return null;
  }

  if (userType === "student") {
    const studyYear = Number(bank.student_year);
    if (!Number.isInteger(studyYear) || studyYear < 1 || studyYear > 10) {
      return null;
    }

    return {
      subjectId: bank.subject_id,
      userType: "student",
      studyYear,
      semester,
      schoolClass: null
    };
  }

  const schoolClass =
    typeof bank.school_class === "string" && bank.school_class.trim().length
      ? normalizeSchoolClassLabel(bank.school_class)
      : null;

  if (!schoolClass) {
    return null;
  }

  return {
    subjectId: bank.subject_id,
    userType: "elev",
    studyYear: null,
    semester,
    schoolClass
  };
}

function mapQuestionBankItems(items, bank) {
  return (items || []).map((item, index) => ({
    id: item.id ?? index + 1,
    text: item.question_text ?? "",
    answers: Array.isArray(item.answers) ? item.answers : [],
    correctIndex: item.correct_index,
    explanation: item.explanation ?? "",
    correction: buildQuestionCorrectionMeta({
      sourceType: "question_bank_item",
      sourceQuestionId: item.id,
      sourceDocumentId: bank?.source_document_id || null
    })
  }));
}

async function getLatestAccessiblePublishedQuestionBankMetaForSubject({ subjectId, userId, membership }) {
  if (!userId || !membership) {
    return null;
  }

  const supabase = createAdminClient();
  const { data: candidateBanks, error: banksError } = await supabase
    .from("ai_question_banks")
    .select(
      "id, user_id, subject_id, status, published_at, visibility_scope, target_cohort_id, target_unit_id, target_institution_id, source_document_id"
    )
    .eq("status", "published")
    .eq("exam_type", "normal")
    .eq("subject_id", subjectId)
    .order("published_at", { ascending: false })
    .limit(25);

  if (banksError) {
    throw banksError;
  }

  return (candidateBanks || []).find((bank) =>
    canAccessPublishedBank(userId, membership, bank)
  ) || null;
}

async function getLatestPublishedQuestionBankForSubject({ subjectId, userId, membership }) {
  const selectedBank = await getLatestAccessiblePublishedQuestionBankMetaForSubject({
    subjectId,
    userId,
    membership
  });

  if (!selectedBank) {
    return null;
  }

  const supabase = createAdminClient();
  const { data: itemRows, error: itemsError } = await supabase
    .from("ai_question_bank_items")
    .select("id, position, question_text, answers, correct_index, explanation")
    .eq("bank_id", selectedBank.id)
    .order("position", { ascending: true });

  if (itemsError) {
    throw itemsError;
  }

  return {
    bankId: selectedBank.id,
    questions: await applyUserQuestionCorrections({
      userId,
      questions: mapQuestionBankItems(itemRows, selectedBank)
    })
  };
}

async function getAccessiblePublishedQuestionBanks({ userId, membership, examType = "normal" }) {
  if (!userId || !membership) {
    return [];
  }

  const supabase = createAdminClient();
  const { data: candidateBanks, error } = await supabase
    .from("ai_question_banks")
    .select(
      "id, user_id, subject_id, subject_name, status, published_at, visibility_scope, target_cohort_id, target_unit_id, target_institution_id, semester, student_year, school_class"
    )
    .eq("status", "published")
    .eq("exam_type", examType)
    .order("published_at", { ascending: false })
    .limit(500);

  if (error) {
    throw error;
  }

  return (candidateBanks || []).filter((bank) =>
    canAccessPublishedBank(userId, membership, bank)
  );
}

async function getPublishedLicentaQuestionBanks({ userId, membership }) {
  if (!userId || !membership) {
    return [];
  }

  const supabase = createAdminClient();
  const { data: candidateBanks, error: banksError } = await supabase
    .from("ai_question_banks")
    .select(
      "id, user_id, subject_id, subject_name, status, published_at, visibility_scope, target_cohort_id, target_unit_id, target_institution_id, source_document_id"
    )
    .eq("status", "published")
    .eq("exam_type", "licenta")
    .order("published_at", { ascending: false })
    .limit(100);

  if (banksError) {
    throw banksError;
  }

  const selectedBySubject = new Map();
  for (const bank of candidateBanks || []) {
    if (!canAccessPublishedBank(userId, membership, bank)) {
      continue;
    }

    const key = bank.subject_id ? `subject:${bank.subject_id}` : `bank:${bank.id}`;
    if (!selectedBySubject.has(key)) {
      selectedBySubject.set(key, bank);
    }
  }

  const selectedBanks = Array.from(selectedBySubject.values());
  if (!selectedBanks.length) {
    return [];
  }

  const bankIds = selectedBanks.map((bank) => bank.id);
  const subjectMap = new Map(
    selectedBanks.map((bank) => [
      bank.id,
      {
        subjectId: bank.subject_id,
        subjectTitle: bank.subject_name,
        sourceDocumentId: bank.source_document_id || null
      }
    ])
  );
  const { data: itemRows, error: itemsError } = await supabase
    .from("ai_question_bank_items")
    .select("id, bank_id, position, question_text, answers, correct_index, explanation")
    .in("bank_id", bankIds)
    .order("position", { ascending: true });

  if (itemsError) {
    throw itemsError;
  }

  const mappedQuestions = (itemRows || []).map((item, index) => {
    const bankSubject = subjectMap.get(item.bank_id) || {};
    return {
      id: item.id ?? index + 1,
      text: item.question_text ?? "",
      answers: Array.isArray(item.answers) ? item.answers : [],
      correctIndex: item.correct_index,
      explanation: item.explanation ?? "",
      subjectId: bankSubject.subjectId || LICENTA_GENERAL_ID,
      subjectTitle: bankSubject.subjectTitle || LICENTA_GENERAL_LABEL,
      correction: buildQuestionCorrectionMeta({
        sourceType: "question_bank_item",
        sourceQuestionId: item.id,
        sourceDocumentId: bankSubject.sourceDocumentId || null
      })
    };
  });

  return applyUserQuestionCorrections({
    userId,
    questions: mappedQuestions
  });
}

function calculateSubjectProgressPercent(row) {
  const studyPercent =
    row.study_total_questions > 0
      ? Math.round((row.study_viewed_count / row.study_total_questions) * 100)
      : 0;
  const interactivePercent =
    row.interactive_total_questions > 0
      ? Math.round((row.interactive_answered / row.interactive_total_questions) * 100)
      : 0;
  const testPercent = row.test_best_score_percent || 0;

  return Math.max(studyPercent, interactivePercent, testPercent);
}

function buildSubjectProgressDescription(row) {
  const mistakeCount = Array.isArray(row.mistake_question_ids)
    ? row.mistake_question_ids.filter(Boolean).length
    : 0;
  const studyPercent =
    row.study_total_questions > 0
      ? Math.round((row.study_viewed_count / row.study_total_questions) * 100)
      : 0;
  const interactivePercent =
    row.interactive_total_questions > 0
      ? Math.round((row.interactive_answered / row.interactive_total_questions) * 100)
      : 0;
  const testPercent = row.test_best_score_percent || 0;

  if (mistakeCount) {
    return `${mistakeCount} greseli de reluat.`;
  }

  if (testPercent >= studyPercent && testPercent >= interactivePercent && testPercent > 0) {
    return `Cel mai bun rezultat la test: ${testPercent}%.`;
  }

  if (interactivePercent >= studyPercent && interactivePercent > 0) {
    return `Ai parcurs ${row.interactive_answered} din ${row.interactive_total_questions} intrebari in modul Interactiv.`;
  }

  if (studyPercent > 0) {
    return `Ai parcurs ${row.study_viewed_count} din ${row.study_total_questions} intrebari la Studiu.`;
  }

  return "Ai inceput deja materia asta.";
}

async function readQuestionPayload(questionPath) {
  try {
    return await readJson(questionPath);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return { questions: [] };
    }

    throw error;
  }
}

async function readSupabaseCatalog() {
  getSupabaseServerEnv();
  const supabase = createAdminClient();
  const [subjectsResult, allocationsResult] = await Promise.all([
    supabase.from("subjects").select("id, title, questions_file").order("title"),
    supabase
      .from("subject_allocations")
      .select("subject_id, user_type, study_year, semester, school_class")
      .order("semester")
  ]);

  if (subjectsResult.error) {
    throw subjectsResult.error;
  }

  if (allocationsResult.error) {
    throw allocationsResult.error;
  }

  return {
    subjects: subjectsResult.data.map(mapSupabaseSubject),
    allocations: allocationsResult.data.map(mapSupabaseAllocation)
  };
}

async function readSubjectsAndAllocations() {
  try {
    const [catalog, localSubjects] = await Promise.all([readSupabaseCatalog(), readLocalSubjects()]);

    return {
      ...catalog,
      subjects: mergeLocalSubjectCatalog(catalog.subjects, localSubjects)
    };
  } catch (error) {
    if (isSupabaseSetupIncompleteError(error)) {
      throw new Error(
        "Catalogul de materii din Supabase nu este gata inca. Ruleaza si verifica migrarile pana la `0008_subject_catalog.sql`."
      );
    }

    throw error;
  }
}

async function createOrAssignSubjectSupabase({
  title,
  userType,
  studyYear,
  semester,
  schoolClass,
  createdByUserId
}) {
  const trimmedTitle = title.trim();
  const normalizedTitle = normalizeText(trimmedTitle);
  const requestedSlug = createSubjectSlug(trimmedTitle);
  const normalizedSchoolClass =
    typeof schoolClass === "string" && schoolClass.trim().length
      ? normalizeSchoolClassLabel(schoolClass)
      : null;

  const supabase = createAdminClient();
  const { subjects, allocations } = await readSupabaseCatalog();

  let subject = subjects.find(
    (item) => normalizeText(item.title) === normalizedTitle || item.id === requestedSlug
  );

  let subjectCreated = false;
  if (!subject) {
    const subjectId = buildUniqueSubjectId(subjects, trimmedTitle);

    const { data: insertedSubject, error: insertError } = await supabase
      .from("subjects")
      .insert({
        id: subjectId,
        title: trimmedTitle,
        questions_file: null,
        source: createdByUserId ? "user" : "admin",
        created_by: createdByUserId || null
      })
      .select("id, title, questions_file")
      .single();

    if (insertError) {
      if (insertError.code !== "23505") {
        throw insertError;
      }

      const { data: existingSubject, error: selectError } = await supabase
        .from("subjects")
        .select("id, title, questions_file")
        .eq("id", subjectId)
        .single();

      if (selectError) {
        throw selectError;
      }

      subject = mapSupabaseSubject(existingSubject);
    } else {
      subject = mapSupabaseSubject(insertedSubject);
      subjectCreated = true;
    }
  }

  const requestedAllocation = {
    subjectId: subject.id,
    userType,
    studyYear: userType === "student" ? studyYear : null,
    semester,
    schoolClass: userType === "elev" ? normalizedSchoolClass : null
  };

  const allocationExists = allocations.some(
    (allocation) => buildAllocationKey(allocation) === buildAllocationKey(requestedAllocation)
  );

  let allocationCreated = false;
  if (!allocationExists) {
    const { error: allocationError } = await supabase.from("subject_allocations").insert({
      subject_id: requestedAllocation.subjectId,
      user_type: requestedAllocation.userType,
      study_year: requestedAllocation.studyYear,
      semester: requestedAllocation.semester,
      school_class: requestedAllocation.schoolClass,
      source: createdByUserId ? "user" : "admin",
      created_by: createdByUserId || null
    });

    if (allocationError && allocationError.code !== "23505") {
      throw allocationError;
    }

    allocationCreated = !allocationError;
  }

  return {
    subject,
    allocation: requestedAllocation,
    subjectCreated,
    allocationCreated,
    alreadyAssigned: allocationExists || !allocationCreated
  };
}

async function ensureSubjectAllocationSupabase({
  subjectId,
  userType,
  studyYear,
  semester,
  schoolClass,
  createdByUserId
}) {
  const supabase = createAdminClient();
  const { subjects, allocations } = await readSupabaseCatalog();
  const subject = subjects.find((item) => item.id === subjectId);

  if (!subject) {
    throw new Error("Materia selectata nu este valida.");
  }

  const requestedAllocation = {
    subjectId,
    userType,
    studyYear: userType === "student" ? studyYear : null,
    semester,
    schoolClass: userType === "elev" ? normalizeSchoolClassLabel(schoolClass || "") : null
  };

  const allocationExists = allocations.some(
    (allocation) => buildAllocationKey(allocation) === buildAllocationKey(requestedAllocation)
  );

  if (!allocationExists) {
    const { error } = await supabase.from("subject_allocations").insert({
      subject_id: requestedAllocation.subjectId,
      user_type: requestedAllocation.userType,
      study_year: requestedAllocation.studyYear,
      semester: requestedAllocation.semester,
      school_class: requestedAllocation.schoolClass,
      source: createdByUserId ? "user" : "admin",
      created_by: createdByUserId || null
    });

    if (error && error.code !== "23505") {
      throw error;
    }
  }

  return {
    subject,
    allocationCreated: !allocationExists
  };
}

export async function getSubjects() {
  const { subjects } = await readSubjectsAndAllocations();
  return sortSubjects(subjects);
}

export async function getSubjectAllocations() {
  const { allocations } = await readSubjectsAndAllocations();
  return allocations;
}

export async function getSubjectsForContext({ userType, studyYear, semester, schoolClass }) {
  const [subjects, allocations] = await Promise.all([getSubjects(), getSubjectAllocations()]);
  const subjectMap = new Map(subjects.map((subject) => [subject.id, subject]));

  const filteredAllocations = allocations.filter((allocation) => {
    if (allocation.userType !== userType) {
      return false;
    }

    if (userType === "student") {
      return allocation.studyYear === studyYear && allocation.semester === semester;
    }

    return (
      allocation.semester === semester &&
      normalizeText(allocation.schoolClass || "") === normalizeText(schoolClass || "")
    );
  });

  const seenSubjectIds = new Set();

  return filteredAllocations
    .map((allocation) => {
      const subject = subjectMap.get(allocation.subjectId);
      if (!subject || seenSubjectIds.has(subject.id)) {
        return null;
      }

      seenSubjectIds.add(subject.id);
      return {
        ...subject,
        allocation
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.title.localeCompare(right.title, "ro"));
}

export async function getSubjectById(subjectId) {
  const subjects = await getSubjects();
  return subjects.find((subject) => subject.id === subjectId) ?? null;
}

export async function getAccessibleSubjectsForUser({ userId, membership, userType = "student" }) {
  const [subjects, banks] = await Promise.all([
    getSubjects(),
    getAccessiblePublishedQuestionBanks({ userId, membership, examType: "normal" })
  ]);
  const catalogSubjects = new Map(subjects.map((subject) => [subject.id, subject]));
  const accessibleSubjects = new Map();
  const accessibleAllocations = new Map();

  for (const bank of banks) {
    if (!isUsableSubjectId(bank.subject_id)) {
      continue;
    }

    const catalogSubject = catalogSubjects.get(bank.subject_id);
    const subject = catalogSubject || {
      id: bank.subject_id,
      title: bank.subject_name || bank.subject_id,
      questionsFile: null
    };

    if (!accessibleSubjects.has(subject.id)) {
      accessibleSubjects.set(subject.id, subject);
    }

    const allocation = mapBankAllocation(bank, userType);
    if (allocation) {
      accessibleAllocations.set(buildAllocationKey(allocation), allocation);
    }
  }

  return {
    subjects: sortSubjects(Array.from(accessibleSubjects.values())),
    subjectAllocations: Array.from(accessibleAllocations.values())
  };
}

export async function getAccessibleSubjectById({ subjectId, userId, membership }) {
  if (!isUsableSubjectId(subjectId)) {
    return null;
  }

  const [subject, bank] = await Promise.all([
    getSubjectById(subjectId),
    getLatestAccessiblePublishedQuestionBankMetaForSubject({
      subjectId,
      userId,
      membership
    })
  ]);

  if (!bank) {
    return null;
  }

  return subject || {
    id: subjectId,
    title: bank.subject_name || subjectId,
    questionsFile: null
  };
}

export async function getQuestionsForSubject(subjectId, options = {}) {
  const { userId = null, membership = null } = options;
  const subject = await getSubjectById(subjectId);
  if (!subject) {
    return null;
  }

  if (userId && membership) {
    const aiBank = await getLatestPublishedQuestionBankForSubject({
      subjectId,
      userId,
      membership
    });

    if (aiBank?.questions?.length) {
      return {
        subject,
        questions: normalizeQuestions(aiBank.questions),
        source: "ai_bank",
        bankId: aiBank.bankId
      };
    }
  }

  if (!subject.questionsFile) {
    return {
      subject,
      questions: [],
      source: "local"
    };
  }

  const questionPath = path.join(process.cwd(), subject.questionsFile);
  const raw = await readQuestionPayload(questionPath);

  return {
    subject,
    questions: normalizeQuestions(raw),
    source: "local"
  };
}

export async function getAllExamQuestions(options = {}) {
  const { userId = null, membership = null } = options;
  if (userId && membership) {
    const licentaQuestions = await getPublishedLicentaQuestionBanks({
      userId,
      membership
    });

    if (licentaQuestions.length) {
      const subjects = Array.from(
        new Map(
          licentaQuestions.map((question) => [
            question.subjectId,
            {
              id: question.subjectId,
              title: question.subjectTitle
            }
          ])
        ).values()
      );
      const normalizedAiQuestions = licentaQuestions
        .map((question, index) => ({
          ...question,
          id: question.id ?? index + 1,
          text: question.text ?? "",
          answers: Array.isArray(question.answers) ? question.answers : [],
          correctIndex: question.correctIndex,
          explanation: question.explanation ?? "",
          subjectId: question.subjectId || LICENTA_GENERAL_ID,
          subjectTitle: question.subjectTitle || LICENTA_GENERAL_LABEL
        }))
        .filter(
          (question) =>
            question.text &&
            Array.isArray(question.answers) &&
            question.answers.length > 0 &&
            Number.isInteger(question.correctIndex)
        );

      return {
        subjects,
        questions: normalizedAiQuestions,
        source: "ai_bank"
      };
    }

    return {
      subjects: [],
      questions: [],
      source: "ai_bank"
    };
  }

  const subjects = await getSubjects();
  const loaded = await Promise.all(
    subjects
      .filter((subject) => subject.questionsFile)
      .map(async (subject) => {
        const questionPath = path.join(process.cwd(), subject.questionsFile);
        const raw = await readQuestionPayload(questionPath);

        return normalizeQuestions(raw).map((question) => ({
          ...question,
          subjectId: subject.id,
          subjectTitle: subject.title
        }));
      })
  );

  return {
    subjects,
    questions: loaded.flat(),
    source: "local"
  };
}

export async function getDemoSubject() {
  const { subjects, questions } = await getAllExamQuestions();
  const subjectId =
    questions[0]?.subjectId ||
    subjects.find((subject) => Boolean(subject.questionsFile))?.id ||
    null;

  if (!subjectId) {
    return null;
  }

  return subjects.find((subject) => subject.id === subjectId) || null;
}

export async function getUserSubjectProgress(userId, limit = 2) {
  try {
    getSupabaseServerEnv();
    const supabase = createAdminClient();
    const [{ data: progressRows, error: progressError }, { subjects }] = await Promise.all([
      supabase
        .from("subject_progress")
        .select(
          "subject_id, study_total_questions, study_viewed_count, interactive_total_questions, interactive_answered, test_best_score_percent, mistake_question_ids, last_mode, last_activity_at"
        )
        .eq("user_id", userId)
        .order("last_activity_at", { ascending: false })
        .limit(Math.max(limit * 3, 6)),
      readSubjectsAndAllocations()
    ]);

    if (progressError) {
      throw progressError;
    }

    const subjectMap = new Map(subjects.map((subject) => [subject.id, subject]));

    return (progressRows || [])
      .map((row) => {
        const subject = subjectMap.get(row.subject_id);
        if (!subject) {
          return null;
        }

        const percent = calculateSubjectProgressPercent(row);

        return {
          id: subject.id,
          title: subject.title,
          percent,
          description: buildSubjectProgressDescription(row),
          lastMode: row.last_mode || null,
          lastActivityAt: row.last_activity_at || null
        };
      })
      .filter(Boolean)
      .slice(0, limit);
  } catch (error) {
    if (isSupabaseSetupIncompleteError(error)) {
      return [];
    }

    throw error;
  }
}

export async function getSubjectProgressSnapshot(userId, subjectId) {
  if (!userId || !subjectId) {
    return null;
  }

  try {
    getSupabaseServerEnv();
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("subject_progress")
      .select(
        "study_total_questions,study_viewed_question_ids,study_viewed_count,interactive_total_questions,interactive_answered,interactive_correct,interactive_wrong,test_best_score_percent,test_last_score_percent,mistake_question_ids,last_mode,last_activity_at"
      )
      .eq("user_id", userId)
      .eq("subject_id", subjectId)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      throw error;
    }

    return data || null;
  } catch (error) {
    if (isSupabaseSetupIncompleteError(error)) {
      return null;
    }

    throw error;
  }
}

export async function createOrAssignSubject({
  title,
  userType,
  studyYear,
  semester,
  schoolClass,
  createdByUserId = null
}) {
  try {
    getSupabaseServerEnv();
    return await createOrAssignSubjectSupabase({
      title,
      userType,
      studyYear,
      semester,
      schoolClass,
      createdByUserId
    });
  } catch (error) {
    if (isSupabaseSetupIncompleteError(error)) {
      throw new Error(
        "Catalogul de materii din Supabase nu este gata inca. Ruleaza si verifica migrarile pana la `0008_subject_catalog.sql`."
      );
    }

    throw error;
  }
}

export async function ensureSubjectAllocation({
  subjectId,
  userType,
  studyYear,
  semester,
  schoolClass,
  createdByUserId = null
}) {
  try {
    getSupabaseServerEnv();
    return await ensureSubjectAllocationSupabase({
      subjectId,
      userType,
      studyYear,
      semester,
      schoolClass,
      createdByUserId
    });
  } catch (error) {
    if (isSupabaseSetupIncompleteError(error)) {
      throw new Error(
        "Catalogul de materii din Supabase nu este gata inca. Ruleaza si verifica migrarile pana la `0008_subject_catalog.sql`."
      );
    }

    throw error;
  }
}
