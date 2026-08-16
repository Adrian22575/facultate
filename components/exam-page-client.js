"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  BookOpen,
  CheckCircle2,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Trophy,
  Users,
  Zap
} from "lucide-react";

import { SectionLabel } from "@/components/ui/section-label";
import { GamificationResultPanel } from "@/components/gamification-result-panel";
import { QuestionCorrectionButton } from "@/components/question-correction-button";
import { TestResultPanel } from "@/components/test-result-panel";
import { ActionLink, Button } from "@/components/ui/action";
import { SurfaceCard } from "@/components/ui/surface-card";
import { InlineFeedback } from "@/components/ui/status";
import { buildLicentaQuestionKey } from "@/lib/licenta-exam-question-key";
import { shuffleArray } from "@/lib/quiz";

import styles from "./exam-page-client.module.css";
import insightStyles from "./test-insight.module.css";
import quizStyles from "./test-quiz.module.css";
import resultStyles from "./test-result-panel.module.css";

const MISTAKES_STORAGE_KEY = "licenta_mistakes";
const QUICK_QUESTION_COUNT = 5;
const VERIFY_QUESTION_COUNT = 10;
const CUSTOM_OPTIONS = [10, 20, 30, 40, 50, 60, 100];

function createAttemptKey() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const MODE_COPY = {
  quick: {
    title: "Runda rapida",
    description: "Ai cateva minute? Fa 5 intrebari rapide si vezi daca esti pe drumul bun.",
    button: "Incepe 5 intrebari",
    icon: Zap
  },
  custom: {
    title: "Antrenament personalizat",
    description: "Alege cate intrebari vrei sa faci acum. Scurt sau serios, tu decizi.",
    button: "Alege numarul",
    icon: SlidersHorizontal
  },
  mistakes: {
    title: "Greselile mele",
    description: "Repeta doar intrebarile la care ai gresit. Aici se recupereaza punctele.",
    button: "Repeta greselile",
    icon: RotateCcw
  },
  verify: {
    title: "Corect sau gresit",
    description: "Primeste un raspuns deja ales si decide rapid daca este corect sau gresit.",
    button: "Verifica raspunsuri",
    icon: CheckCircle2
  },
  browse: {
    title: "Parcurge intrebarile",
    description: "Vezi intrebarile si raspunsurile corecte, una cate una. Bun pentru memorare.",
    button: "Invata pe rand",
    icon: BookOpen
  }
};

function readStoredMistakeIds() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(MISTAKES_STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function answerLabel(index) {
  return String.fromCharCode(65 + index);
}

function getResultSubjectMeta(question) {
  const subjectTitle = String(question.subjectTitle || "").trim();

  if (!subjectTitle || subjectTitle.toLowerCase() === "licenta generala") {
    return "";
  }

  return `Materia: ${subjectTitle}`;
}

function getProposedAnswerIndex(question, index) {
  const answers = Array.isArray(question.answers) ? question.answers : [];
  const answerCount = answers.length;
  const correctIndex = Number.isInteger(question.correctIndex) ? question.correctIndex : 0;

  if (answerCount < 2 || index % 2 === 0) {
    return Math.min(correctIndex, Math.max(answerCount - 1, 0));
  }

  const wrongIndexes = answers
    .map((_, answerIndex) => answerIndex)
    .filter((answerIndex) => answerIndex !== correctIndex);

  return wrongIndexes[index % wrongIndexes.length] ?? correctIndex;
}

function formatRank(stats) {
  if (!stats?.userRank || !stats?.participantCount) {
    return "In curs";
  }

  return `#${stats.userRank} din ${stats.participantCount}`;
}

function getCommunityComparison(stats) {
  const userScore = Number(stats?.userLatestScore);
  const averageScore = Number(stats?.averageScore);

  if (!Number.isFinite(userScore) || !Number.isFinite(averageScore) || averageScore <= 0) {
    return null;
  }

  const delta = Math.round(userScore - averageScore);
  const absDelta = Math.abs(delta);
  const scopeLabel = stats?.scopeLabel || "comunitatea ta";

  if (delta > 0) {
    return {
      delta,
      tone: "positive",
      title: "Esti peste media comunitatii",
      detail: `Ai +${absDelta} puncte peste media din ${scopeLabel}.`
    };
  }

  if (delta < 0) {
    return {
      delta,
      tone: "negative",
      title: "Esti sub media comunitatii",
      detail: `Mai ai ${absDelta} puncte pana la media din ${scopeLabel}.`
    };
  }

  return {
    delta,
    tone: "neutral",
    title: "Esti la media comunitatii",
    detail: `Esti exact la media din ${scopeLabel}.`
  };
}

function getCommunityNextStep(stats, comparison) {
  const score = Number(stats?.userLatestScore || 0);

  if (comparison?.tone === "negative") {
    return "Repeta intrebarile gresite si mai fa o runda scurta.";
  }

  if (score >= 80) {
    return "Pastreaza ritmul: repeta doar greselile si urmareste recordul personal.";
  }

  if (score >= 50) {
    return "Mai fa o simulare si incearca sa treci peste 80%.";
  }

  return "Incepe cu greselile salvate, apoi revino la o runda rapida.";
}

function CommunityComparisonPanel({ stats, status, error }) {
  if (status === "saving") {
    return (
      <section className={`${insightStyles.panel} ${insightStyles.loading}`} aria-live="polite">
        <div className={insightStyles.head}>
          <span className={insightStyles.icon} aria-hidden="true">
            <BarChart3 />
          </span>
          <div>
            <h3>Comparam rezultatul cu comunitatea ta</h3>
            <p>Salvam runda si pregatim statisticile anonime.</p>
          </div>
        </div>
      </section>
    );
  }

  if (status === "error") {
    return (
      <section className={`${insightStyles.panel} ${insightStyles.muted}`} aria-live="polite">
        <div className={insightStyles.head}>
          <span className={insightStyles.icon} aria-hidden="true">
            <BarChart3 />
          </span>
          <div>
            <h3>Comparatia nu este disponibila acum</h3>
            <p>{error || "Rezultatul tau ramane calculat local. Incearca din nou la urmatoarea runda."}</p>
          </div>
        </div>
        <ActionLink className={insightStyles.statsAction} variant="secondary" href="/statistici">
          Vezi statistici
        </ActionLink>
      </section>
    );
  }

  if (!stats) {
    return null;
  }

  const comparison = getCommunityComparison(stats);
  const toneClass = insightStyles[comparison?.tone || "neutral"];

  return (
    <section className={`${insightStyles.panel} ${toneClass}`} aria-label="Comparatie cu comunitatea">
      <div className={insightStyles.head}>
        <span className={insightStyles.icon} aria-hidden="true">
          <Users />
        </span>
        <div>
          <span className={insightStyles.kicker}>Cursa comunitatii</span>
          <h3>{comparison?.title || "Rezultatul tau este salvat"}</h3>
          <p>{comparison?.detail || "Mai avem nevoie de rezultate in comunitatea ta ca sa calculam comparatia."}</p>
        </div>
      </div>

      <div className={insightStyles.compareRow}>
        <div className={insightStyles.scoreCard}>
          <span>Tu</span>
          <strong>{`${stats.userLatestScore}%`}</strong>
        </div>
        <div className={insightStyles.scoreCard}>
          <span>Comunitatea</span>
          <strong>{`${stats.averageScore}%`}</strong>
        </div>
        <div className={insightStyles.scoreCard}>
          <span>Locul tau</span>
          <strong>{formatRank(stats)}</strong>
          <small>dupa cel mai bun scor</small>
        </div>
      </div>

      <p className={insightStyles.nextStep}>
        <strong>Urmatorul pas:</strong> {getCommunityNextStep(stats, comparison)}
      </p>
      <div className={insightStyles.footer}>
        <p>
          Comparatia foloseste {stats.attemptCount} incercari de la {stats.participantCount} utilizatori din{" "}
          {stats.scopeLabel || "comunitatea ta"}.
        </p>
        <ActionLink className={insightStyles.statsAction} variant="secondary" href="/statistici">
          Vezi statistici
        </ActionLink>
      </div>
    </section>
  );
}

function buildSubjectBreakdown(summary) {
  const subjectMap = new Map();
  const wrongIds = new Set(summary.wrongQuestions.map(({ question }) => question.stableId));

  for (const question of summary.completedQuestions) {
    const subjectId = String(question.subjectId || "licenta").trim();
    const title = String(question.subjectTitle || "Licenta generala").trim();
    const current = subjectMap.get(subjectId) || {
      subjectId,
      title,
      total: 0,
      correct: 0,
      wrong: 0
    };

    current.total += 1;
    if (wrongIds.has(question.stableId)) {
      current.wrong += 1;
    } else {
      current.correct += 1;
    }

    subjectMap.set(subjectId, current);
  }

  return Array.from(subjectMap.values());
}

function scrollToTop() {
  if (typeof window !== "undefined") {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

function normalizeBrowseSearchValue(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getBrowseSearchHaystack(question, index) {
  return normalizeBrowseSearchValue(
    [
      index + 1,
      question?.text,
      question?.subjectTitle,
      ...(Array.isArray(question?.answers) ? question.answers : [])
    ].join(" ")
  );
}

function getBrowseSearchPreview(question) {
  const text = String(question?.text || "").replace(/\s+/g, " ").trim();
  return text.length > 150 ? `${text.slice(0, 150).trim()}...` : text;
}

export function ExamPageClient({ questions, subjectCount, initialMistakeIds = [] }) {
  const [questionSource, setQuestionSource] = useState(questions);
  const preparedQuestions = useMemo(
    () =>
      questionSource.map((question, index) => ({
        ...question,
        stableId: buildLicentaQuestionKey(question, index)
      })),
    [questionSource]
  );
  const questionById = useMemo(
    () => new Map(preparedQuestions.map((question) => [question.stableId, question])),
    [preparedQuestions]
  );

  const [phase, setPhase] = useState("modes");
  const [activeMode, setActiveMode] = useState(null);
  const [currentQuestions, setCurrentQuestions] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [mistakeIds, setMistakeIds] = useState([]);
  const [notice, setNotice] = useState("");
  const [browseIndex, setBrowseIndex] = useState(0);
  const [showBrowseAnswer, setShowBrowseAnswer] = useState(false);
  const [browseSearchQuery, setBrowseSearchQuery] = useState("");
  const [resultSummary, setResultSummary] = useState(null);
  const [communityStats, setCommunityStats] = useState(null);
  const [communityStatsStatus, setCommunityStatsStatus] = useState("idle");
  const [communityStatsError, setCommunityStatsError] = useState("");
  const [gamificationResult, setGamificationResult] = useState(null);
  const [quizValidationMessage, setQuizValidationMessage] = useState("");
  const attemptKeyRef = useRef("");
  const finishingRef = useRef(false);
  const browseSearchInputRef = useRef(null);

  useEffect(() => {
    setQuestionSource(questions);
  }, [questions]);

  useEffect(() => {
    const validIds = Array.from(
      new Set([...initialMistakeIds, ...readStoredMistakeIds()])
    ).filter((id) => questionById.has(id));
    setMistakeIds(validIds);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(MISTAKES_STORAGE_KEY, JSON.stringify(validIds));
    }
  }, [initialMistakeIds, questionById]);

  function replaceMistakes(nextIds) {
    const validIds = Array.from(new Set(nextIds || [])).filter((id) => questionById.has(id));
    setMistakeIds(validIds);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(MISTAKES_STORAGE_KEY, JSON.stringify(validIds));
    }
  }

  function updateMistakes(updater) {
    setMistakeIds((currentIds) => {
      const nextIds = Array.from(new Set(updater(currentIds))).filter((id) => questionById.has(id));

      if (typeof window !== "undefined") {
        window.localStorage.setItem(MISTAKES_STORAGE_KEY, JSON.stringify(nextIds));
      }

      return nextIds;
    });
  }

  function addMistake(question) {
    updateMistakes((currentIds) => [...currentIds, question.stableId]);
  }

  function removeMistake(question) {
    updateMistakes((currentIds) => currentIds.filter((id) => id !== question.stableId));
  }

  function goToModes(message = "") {
    attemptKeyRef.current = "";
    finishingRef.current = false;
    setPhase("modes");
    setActiveMode(null);
    setCurrentQuestions([]);
    setAnswers([]);
    setResultSummary(null);
    setCommunityStats(null);
    setCommunityStatsStatus("idle");
    setCommunityStatsError("");
    setQuizValidationMessage("");
    setBrowseSearchQuery("");
    setNotice(message);
    scrollToTop();
  }

  function startQuiz(numberOfQuestions, mode) {
    attemptKeyRef.current = "";
    finishingRef.current = false;
    setNotice("");
    setResultSummary(null);
    setCommunityStats(null);
    setCommunityStatsStatus("idle");
    setCommunityStatsError("");
    setQuizValidationMessage("");
    setActiveMode(mode);

    const sourceQuestions =
      mode === "mistakes"
        ? mistakeIds.map((id) => questionById.get(id)).filter(Boolean)
        : preparedQuestions;

    if (!sourceQuestions.length) {
      setActiveMode(null);
      setNotice(
        mode === "mistakes"
          ? "Inca nu ai greseli salvate. Fa mai intai o runda rapida sau un antrenament."
          : "Nu exista intrebari disponibile momentan."
      );
      setPhase("modes");
      scrollToTop();
      return;
    }

    const requestedCount = mode === "mistakes" ? sourceQuestions.length : numberOfQuestions;
    const selectedQuestions = shuffleArray(sourceQuestions).slice(
      0,
      Math.min(requestedCount, sourceQuestions.length)
    );

    setCurrentQuestions(selectedQuestions);
    setAnswers(new Array(selectedQuestions.length).fill(null));
    attemptKeyRef.current = createAttemptKey();
    setPhase("quiz");
    scrollToTop();
  }

  function startVerifyRound() {
    attemptKeyRef.current = "";
    finishingRef.current = false;
    setNotice("");
    setResultSummary(null);
    setCommunityStats(null);
    setCommunityStatsStatus("idle");
    setCommunityStatsError("");
    setQuizValidationMessage("");
    setActiveMode("verify");

    if (!preparedQuestions.length) {
      setActiveMode(null);
      setNotice("Nu exista intrebari disponibile momentan.");
      setPhase("modes");
      scrollToTop();
      return;
    }

    const selectedQuestions = shuffleArray(preparedQuestions)
      .slice(0, Math.min(VERIFY_QUESTION_COUNT, preparedQuestions.length))
      .map((question, index) => ({
        ...question,
        proposedIndex: getProposedAnswerIndex(question, index)
      }));

    setCurrentQuestions(selectedQuestions);
    setAnswers(new Array(selectedQuestions.length).fill(null));
    attemptKeyRef.current = createAttemptKey();
    setPhase("quiz");
    scrollToTop();
  }

  function startBrowseQuestions() {
    setNotice("");
    setResultSummary(null);
    setCommunityStats(null);
    setCommunityStatsStatus("idle");
    setCommunityStatsError("");
    setQuizValidationMessage("");
    setActiveMode("browse");
    setBrowseSearchQuery("");

    if (!preparedQuestions.length) {
      setNotice("Nu exista intrebari disponibile momentan.");
      setPhase("modes");
      scrollToTop();
      return;
    }

    setCurrentQuestions(preparedQuestions);
    setBrowseIndex(0);
    setShowBrowseAnswer(false);
    setPhase("browse");
    scrollToTop();
  }

  const normalizedBrowseSearchQuery = useMemo(
    () => normalizeBrowseSearchValue(browseSearchQuery),
    [browseSearchQuery]
  );
  const browseSearchResults = useMemo(() => {
    if (!normalizedBrowseSearchQuery || !currentQuestions.length) {
      return [];
    }

    return currentQuestions
      .map((question, index) => ({ question, index }))
      .filter(({ question, index }) =>
        getBrowseSearchHaystack(question, index).includes(normalizedBrowseSearchQuery)
      )
      .slice(0, 12);
  }, [currentQuestions, normalizedBrowseSearchQuery]);
  const browseSearchTotalCount = useMemo(() => {
    if (!normalizedBrowseSearchQuery || !currentQuestions.length) {
      return 0;
    }

    return currentQuestions.reduce(
      (total, question, index) =>
        getBrowseSearchHaystack(question, index).includes(normalizedBrowseSearchQuery)
          ? total + 1
          : total,
      0
    );
  }, [currentQuestions, normalizedBrowseSearchQuery]);

  function answerQuestion(questionIndex, answerIndex) {
    const question = currentQuestions[questionIndex];
    const nextAnswers = [...answers];
    nextAnswers[questionIndex] = answerIndex;
    setAnswers(nextAnswers);
    setQuizValidationMessage("");

    if (activeMode === "mistakes") {
      if (answerIndex === question.correctIndex) {
        removeMistake(question);
      } else {
        addMistake(question);
      }
    }
  }

  function answerVerificationQuestion(questionIndex, userBelievesCorrect) {
    const nextAnswers = [...answers];
    nextAnswers[questionIndex] = userBelievesCorrect;
    setAnswers(nextAnswers);
    setQuizValidationMessage("");
  }

  async function saveLicentaAttempt(summary) {
    setCommunityStatsStatus("saving");
    setCommunityStatsError("");
    setGamificationResult(null);

    try {
      const response = await fetch("/api/licenta-exam/attempts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          idempotencyKey: summary.idempotencyKey,
          mode: summary.mode,
          score: summary.score,
          total: summary.total,
          percentage: summary.percentage,
          wrongCount: summary.wrongQuestions.length,
          unansweredCount: summary.completedAnswers.filter((answer) => answer === null).length,
          questionIds: summary.completedQuestions.map((question) => question.stableId),
          wrongQuestionIds: summary.wrongQuestions.map(({ question }) => question.stableId),
          subjectBreakdown: buildSubjectBreakdown(summary)
        })
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || "Nu am putut salva rezultatul pentru comparatie.");
      }

      setCommunityStats(payload.communityStats || null);
      setGamificationResult(payload.gamification || null);
      if (Array.isArray(payload.mistakeQuestionIds)) {
        replaceMistakes(payload.mistakeQuestionIds);
      }
      setCommunityStatsStatus("ready");
    } catch (error) {
      setCommunityStats(null);
      setGamificationResult(null);
      setCommunityStatsStatus("error");
      setCommunityStatsError(
        error instanceof Error
          ? error.message
          : "Nu am putut salva rezultatul pentru comparatie."
      );
    }
  }

  function finishQuiz() {
    if (finishingRef.current) {
      return;
    }

    const unansweredIndexes = answers
      .map((answer, index) => (answer === null ? index : null))
      .filter((index) => index !== null);

    if (unansweredIndexes.length) {
      const firstUnanswered = unansweredIndexes[0] + 1;
      setQuizValidationMessage(
        unansweredIndexes.length === 1
          ? `Mai ai intrebarea ${firstUnanswered} fara raspuns. Alege un raspuns inainte sa vezi rezultatul.`
          : `Mai ai ${unansweredIndexes.length} intrebari fara raspuns. Prima este intrebarea ${firstUnanswered}.`
      );
      return;
    }

    finishingRef.current = true;

    const wrongQuestions = [];
    let score = 0;

    currentQuestions.forEach((question, index) => {
      const selectedAnswer = answers[index];
      const proposedIndex =
        activeMode === "verify" && Number.isInteger(question.proposedIndex)
          ? question.proposedIndex
          : null;
      const proposedIsCorrect = proposedIndex === question.correctIndex;
      const isCorrect =
        activeMode === "verify"
          ? selectedAnswer === proposedIsCorrect
          : selectedAnswer === question.correctIndex;

      if (isCorrect) {
        score += 1;
        if (activeMode === "mistakes") {
          removeMistake(question);
        }
        return;
      }

      wrongQuestions.push({
        question,
        selectedIndex: activeMode === "verify" ? null : selectedAnswer,
        selectedTruth: activeMode === "verify" ? selectedAnswer : null,
        proposedIndex
      });
      addMistake(question);
    });

    const percentage = currentQuestions.length ? Math.round((score / currentQuestions.length) * 100) : 0;

    const nextSummary = {
      mode: activeMode,
      score,
      total: currentQuestions.length,
      percentage,
      idempotencyKey: attemptKeyRef.current || createAttemptKey(),
      wrongQuestions,
      completedQuestions: currentQuestions,
      completedAnswers: answers
    };

    setResultSummary(nextSummary);
    setPhase("result");
    void saveLicentaAttempt(nextSummary);
    scrollToTop();
  }

  function repeatCurrentTest() {
    if (!resultSummary?.completedQuestions?.length) {
      goToModes();
      return;
    }

    finishingRef.current = false;
    setNotice("");
    setResultSummary(null);
    setCommunityStats(null);
    setCommunityStatsStatus("idle");
    setCommunityStatsError("");
    setGamificationResult(null);
    setQuizValidationMessage("");
    setActiveMode(resultSummary.mode);
    setCurrentQuestions(resultSummary.completedQuestions);
    setAnswers(new Array(resultSummary.completedQuestions.length).fill(null));
    attemptKeyRef.current = createAttemptKey();
    setPhase("quiz");
    scrollToTop();
  }

  function startAnotherTest() {
    if (!resultSummary) {
      goToModes();
      return;
    }

    if (resultSummary.mode === "quick") {
      startQuiz(QUICK_QUESTION_COUNT, "quick");
      return;
    }

    if (resultSummary.mode === "verify") {
      startVerifyRound();
      return;
    }

    if (resultSummary.mode === "mistakes") {
      startQuiz(mistakeIds.length, "mistakes");
      return;
    }

    startQuiz(resultSummary.total, "custom");
  }

  function goToPreviousBrowseQuestion() {
    if (browseIndex <= 0) return;
    setBrowseIndex((index) => index - 1);
    setShowBrowseAnswer(false);
  }

  function goToNextBrowseQuestion() {
    if (browseIndex >= currentQuestions.length - 1) {
      goToModes("Ai parcurs toate intrebarile disponibile.");
      return;
    }

    setBrowseIndex((index) => index + 1);
    setShowBrowseAnswer(false);
  }

  function jumpToBrowseQuestion(index) {
    if (index < 0 || index >= currentQuestions.length) {
      return;
    }

    setBrowseIndex(index);
    setShowBrowseAnswer(false);
  }

  function handleBrowseSearchSubmit(event) {
    event.preventDefault();
    const firstResult = browseSearchResults[0];
    if (firstResult) {
      jumpToBrowseQuestion(firstResult.index);
    }
  }

  function mergeCorrectedQuestion(question, correction) {
    if (question?.correction?.sourceQuestionId !== correction.sourceQuestionId) {
      return question;
    }

    return {
      ...question,
      text: correction.text,
      answers: correction.answers,
      correctIndex: correction.correctIndex,
      explanation: correction.explanation,
      correction: {
        ...(question.correction || {}),
        ...correction,
        hasPersonalCorrection: true
      }
    };
  }

  function applySavedCorrection(correction) {
    setQuestionSource((current) => current.map((question) => mergeCorrectedQuestion(question, correction)));
    setCurrentQuestions((current) => current.map((question) => mergeCorrectedQuestion(question, correction)));
    setResultSummary((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        completedQuestions: current.completedQuestions.map((question) =>
          mergeCorrectedQuestion(question, correction)
        ),
        wrongQuestions: current.wrongQuestions.map((row) => ({
          ...row,
          question: mergeCorrectedQuestion(row.question, correction)
        }))
      };
    });
  }

  if (!preparedQuestions.length) {
    return (
      <SurfaceCard className={styles["exam-empty-state"]}>
        <div className={styles["exam-empty-state-copy"]}>
          <span className="step-eyebrow">Pregatire licenta</span>
          <h2>Nu exista inca grile de licenta</h2>
          <p>
            Incarca un PDF sau un fisier cu grilele din care platforma sa invete, iar dupa
            publicare intrebarile vor intra direct in pregatirea generala de licenta.
          </p>
        </div>

        <div className={styles["exam-empty-state-actions"]}>
          <ActionLink href="/materiale/licenta">
            Incarca grilele de licenta
          </ActionLink>
          <ActionLink variant="secondary" href="/">
            Inapoi la dashboard
          </ActionLink>
        </div>
      </SurfaceCard>
    );
  }

  const activeModeCopy = activeMode ? MODE_COPY[activeMode] : null;
  const isVerificationMode = activeMode === "verify";
  const isResultVerificationMode = resultSummary?.mode === "verify";
  const answeredCount = answers.filter((answer) => answer !== null).length;
  const hasAnsweredAllQuestions = answeredCount === currentQuestions.length;
  const browseQuestion = currentQuestions[browseIndex];

  return (
    <section className={styles["licenta-prep"]}>
      {phase === "modes" ? (
        <>
          <SurfaceCard className={styles["licenta-prep-summary"]}>
            <div>
              <SectionLabel>Pregatire licenta</SectionLabel>
              <h2>Alege modul potrivit pentru sesiunea de azi.</h2>
              <p className="page-copy">
                Sunt disponibile {preparedQuestions.length} intrebari din {subjectCount} surse. Greseli salvate:{" "}
                <strong>{mistakeIds.length}</strong>.
              </p>
            </div>
            <div className={styles["licenta-prep-summary-badge"]} aria-hidden="true">
              <Trophy />
            </div>
          </SurfaceCard>

          {notice ? <InlineFeedback className={styles["licenta-prep-notice"]} tone="error" role="status">{notice}</InlineFeedback> : null}

          <div className={styles["licenta-prep-mode-grid"]} aria-label="Moduri pregatire licenta">
            {["quick", "custom", "mistakes", "verify", "browse"].map((mode) => {
              const copy = MODE_COPY[mode];
              const Icon = copy.icon;
              const isBrowse = mode === "browse";

              return (
                <article
                  key={mode}
                  className={`${styles["licenta-prep-mode-card"]}${isBrowse ? ` ${styles["is-wide"]}` : ""}`}
                >
                  <div className={styles["licenta-prep-mode-icon"]} aria-hidden="true">
                    <Icon />
                  </div>
                  <div className={styles["licenta-prep-mode-copy"]}>
                    <h2>{copy.title}</h2>
                    <p>{copy.description}</p>
                  </div>
                  <Button
                    variant={mode === "mistakes" ? "secondary" : "primary"}
                    onClick={() => {
                      if (mode === "quick") startQuiz(QUICK_QUESTION_COUNT, "quick");
                      if (mode === "custom") {
                        setNotice("");
                        setPhase("custom-select");
                        scrollToTop();
                      }
                      if (mode === "mistakes") startQuiz(mistakeIds.length, "mistakes");
                      if (mode === "verify") startVerifyRound();
                      if (mode === "browse") startBrowseQuestions();
                    }}
                  >
                    {copy.button}
                  </Button>
                </article>
              );
            })}
          </div>
        </>
      ) : null}

      {phase === "custom-select" ? (
        <SurfaceCard className={styles["licenta-prep-panel"]}>
          <div className={styles["licenta-prep-panel-head"]}>
            <div>
              <SectionLabel>Antrenament personalizat</SectionLabel>
              <h2>Alege cate intrebari vrei sa faci acum.</h2>
              <p className="page-copy">
                Daca alegi mai multe intrebari decat exista disponibile, folosim toate intrebarile.
              </p>
            </div>
            <Button variant="secondary" onClick={() => goToModes()}>
              Inapoi la moduri
            </Button>
          </div>

          <div className={styles["licenta-prep-count-grid"]}>
            {CUSTOM_OPTIONS.map((count) => (
              <Button key={count} onClick={() => startQuiz(count, "custom")}>
                {count} intrebari
              </Button>
            ))}
          </div>
        </SurfaceCard>
      ) : null}

      {phase === "quiz" ? (
        <>
          <SurfaceCard className={styles["licenta-prep-running-bar"]}>
            <div className={styles["exam-info-row"]}>
              <div>
                <div className={styles["exam-info-title"]}>{activeModeCopy?.title || "Test licenta"}</div>
                <div className={styles["exam-info-meta"]}>
                  {isVerificationMode
                    ? `Intrebari: ${currentQuestions.length} | Verificate: ${answeredCount} | Neverificate: ${currentQuestions.length - answeredCount}`
                    : `Intrebari: ${currentQuestions.length} | Raspunse: ${answeredCount} | Neraspunse: ${currentQuestions.length - answeredCount}`}
                </div>
              </div>
              <div className={styles["licenta-prep-actions"]}>
                <Button variant="secondary" onClick={() => goToModes()}>
                  Inapoi la moduri
                </Button>
              </div>
            </div>
          </SurfaceCard>

          <div className={styles["licenta-prep-question-list"]}>
            {currentQuestions.map((question, index) => (
              <article key={`${question.stableId}-${index}`} className={`${quizStyles.question} ${styles["licenta-prep-question"]}`}>
                <div className={quizStyles.inlineHead}>
                  <div className={quizStyles.questionTitle}>
                    <span>{`${index + 1}. `}</span>
                    <span className="question-rich-text">{question.text}</span>
                  </div>
                  <QuestionCorrectionButton question={question} onSaved={applySavedCorrection} />
                </div>
                {getResultSubjectMeta(question) ? (
                  <div className="meta">{getResultSubjectMeta(question)}</div>
                ) : null}
                {isVerificationMode ? (
                  <>
                    <div className={`${quizStyles.answers} ${styles["licenta-prep-answers"]} ${styles["licenta-prep-answers-check"]}`}>
                      {question.answers.map((answer, answerIndex) => (
                        <div
                          key={`${question.stableId}-verify-${answerIndex}`}
                          className={`${styles["licenta-prep-answer-row"]}${
                            answerIndex === question.proposedIndex ? ` ${styles["is-proposed"]}` : ""
                          }`}
                        >
                          <span>
                            <span>{`${answerLabel(answerIndex)}. `}</span>
                            <span className="question-rich-text">{answer}</span>
                          </span>
                          {answerIndex === question.proposedIndex ? (
                            <strong>Ales ca raspuns</strong>
                          ) : null}
                        </div>
                      ))}
                    </div>
                    <div className={styles["licenta-prep-truth-actions"]} aria-label="Alege daca raspunsul propus este corect">
                      <Button
                        variant="secondary"
                        aria-pressed={answers[index] === true}
                        className={`${styles["licenta-prep-truth-button"]} ${styles["is-correct-choice"]}${answers[index] === true ? ` ${styles["is-selected"]}` : ""}`}
                        onClick={() => answerVerificationQuestion(index, true)}
                      >
                        Corect
                      </Button>
                      <Button
                        variant="secondary"
                        aria-pressed={answers[index] === false}
                        className={`${styles["licenta-prep-truth-button"]} ${styles["is-wrong-choice"]}${answers[index] === false ? ` ${styles["is-selected"]}` : ""}`}
                        onClick={() => answerVerificationQuestion(index, false)}
                      >
                        Gresit
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className={`${quizStyles.answers} ${styles["licenta-prep-answers"]}`}>
                    {question.answers.map((answer, answerIndex) => (
                      <label
                        key={`${question.stableId}-${answerIndex}`}
                        className={`${quizStyles.answerLabel}${answers[index] === answerIndex ? ` ${styles["is-selected"]}` : ""}`}
                      >
                        <input
                          checked={answers[index] === answerIndex}
                          name={`licenta-q-${index}`}
                          type="radio"
                          value={answerIndex}
                          onChange={() => answerQuestion(index, answerIndex)}
                        />
                        <span>
                          <span>{`${answerLabel(answerIndex)}. `}</span>
                          <span className="question-rich-text">{answer}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>

          <SurfaceCard className={styles["licenta-prep-finish-panel"]} aria-label="Finalizeaza runda">
            <div>
              <SectionLabel>Runda aproape gata</SectionLabel>
              <h2>Ai ajuns la finalul intrebarilor.</h2>
              <p className="page-copy">
                {isVerificationMode
                  ? `Ai verificat ${answeredCount} din ${currentQuestions.length} raspunsuri propuse. Poti vedea rezultatul acum sau te poti intoarce la moduri.`
                  : `Ai raspuns la ${answeredCount} din ${currentQuestions.length} intrebari. Poti vedea rezultatul acum sau te poti intoarce la moduri.`}
              </p>
              {quizValidationMessage ? (
                <InlineFeedback className={styles.validation} tone="error" role="alert">{quizValidationMessage}</InlineFeedback>
              ) : null}
            </div>
            <div className={styles["licenta-prep-actions"]}>
              <Button variant="secondary" onClick={() => goToModes()}>
                Inapoi la moduri
              </Button>
              <Button
                className={!hasAnsweredAllQuestions ? styles["is-disabled-soft"] : undefined}
                onClick={finishQuiz}
              >
                Vezi rezultatul
              </Button>
            </div>
          </SurfaceCard>
        </>
      ) : null}

      {phase === "browse" && browseQuestion ? (
        <SurfaceCard className={styles["licenta-prep-browse"]}>
          <div className={styles["licenta-prep-panel-head"]}>
            <div>
              <SectionLabel>Parcurge intrebarile</SectionLabel>
              <h2>{`Intrebarea ${browseIndex + 1} din ${currentQuestions.length}`}</h2>
              <p className="page-copy">
                Raspunsul corect este ascuns pana cand alegi sa il vezi.
              </p>
            </div>
            <Button variant="secondary" onClick={() => goToModes()}>
              Inapoi la moduri
            </Button>
          </div>

          <form className={styles["licenta-browse-search"]} onSubmit={handleBrowseSearchSubmit}>
            <label htmlFor="licenta-browse-search-input">
              <span>Cauta rapid o intrebare</span>
              <div className={styles["licenta-browse-search-control"]}>
                <Search aria-hidden="true" size={18} strokeWidth={2.3} />
                <input
                  ref={browseSearchInputRef}
                  id="licenta-browse-search-input"
                  type="search"
                  value={browseSearchQuery}
                  onChange={(event) => setBrowseSearchQuery(event.target.value)}
                  placeholder="Cauta dupa cuvinte din intrebare sau raspuns..."
                  autoComplete="off"
                />
              </div>
            </label>

            {normalizedBrowseSearchQuery ? (
              <div className={styles["licenta-browse-search-results"]} aria-live="polite">
                <div className={styles["licenta-browse-search-meta"]}>
                  <strong>
                    {browseSearchTotalCount
                      ? `${browseSearchTotalCount} ${browseSearchTotalCount === 1 ? "rezultat" : "rezultate"}`
                      : "Niciun rezultat"}
                  </strong>
                  {browseSearchQuery ? (
                    <button type="button" className={styles["clear-action"]} onClick={() => setBrowseSearchQuery("")}>
                      Sterge cautarea
                    </button>
                  ) : null}
                </div>

                {browseSearchResults.length ? (
                  <div className={styles["licenta-browse-search-list"]}>
                    {browseSearchResults.map(({ question, index }) => (
                      <button
                        key={`${question.stableId}-search-${index}`}
                        type="button"
                        className={`${styles["licenta-browse-search-result"]}${index === browseIndex ? ` ${styles["is-active"]}` : ""}`}
                        onClick={() => jumpToBrowseQuestion(index)}
                      >
                        <span>{`Intrebarea ${index + 1}`}</span>
                        <strong>{getBrowseSearchPreview(question)}</strong>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p>Incearca un cuvant mai scurt sau o varianta de raspuns.</p>
                )}
              </div>
            ) : null}
          </form>

          <article className={`${quizStyles.question} ${styles["licenta-prep-question"]}`}>
            <div className={quizStyles.inlineHead}>
              <div className={quizStyles.questionTitle}>
                <span className="question-rich-text">{browseQuestion.text}</span>
              </div>
              <QuestionCorrectionButton question={browseQuestion} onSaved={applySavedCorrection} />
            </div>
            {getResultSubjectMeta(browseQuestion) ? (
              <div className="meta">{getResultSubjectMeta(browseQuestion)}</div>
            ) : null}
            <div className={`${quizStyles.answers} ${styles["licenta-prep-answers"]} ${styles["is-review"]}`}>
              {browseQuestion.answers.map((answer, answerIndex) => (
                <div
                  key={`${browseQuestion.stableId}-browse-${answerIndex}`}
                  className={`${styles["licenta-prep-answer-row"]}${
                    showBrowseAnswer && answerIndex === browseQuestion.correctIndex ? ` ${styles["is-correct"]}` : ""
                  }`}
                >
                  <span>
                    <span>{`${answerLabel(answerIndex)}. `}</span>
                    <span className="question-rich-text">{answer}</span>
                  </span>
                </div>
              ))}
            </div>
            {showBrowseAnswer && browseQuestion.explanation ? (
              <div className="study-explanation">
                <strong>Explicatie</strong>
                <p>{browseQuestion.explanation}</p>
              </div>
            ) : null}
          </article>

          <div className={styles["licenta-prep-actions"]}>
            <Button
              variant="secondary"
              disabled={browseIndex === 0}
              onClick={goToPreviousBrowseQuestion}
            >
              Intrebarea anterioara
            </Button>
            {!showBrowseAnswer ? (
              <Button onClick={() => setShowBrowseAnswer(true)}>
                Arata raspunsul
              </Button>
            ) : (
              <Button onClick={goToNextBrowseQuestion}>
                {browseIndex === currentQuestions.length - 1 ? "Incheie parcurgerea" : "Urmatoarea"}
              </Button>
            )}
          </div>
        </SurfaceCard>
      ) : null}

      {phase === "result" && resultSummary ? (
        <TestResultPanel
          title="Rezultat final"
          score={resultSummary.score}
          total={resultSummary.total}
          percentage={resultSummary.percentage}
          stats={[{ label: "Greseli salvate", value: mistakeIds.length }]}
          wrongTitle={isResultVerificationMode ? "Verificari gresite" : "Intrebari gresite"}
          wrongRows={resultSummary.wrongQuestions.map((row, index) => ({
            ...row,
            id: `${row.question.stableId}-wrong-${index}`,
            questionText: row.question.text,
            meta: getResultSubjectMeta(row.question)
          }))}
          renderWrongDetails={(row) => (
            <>
              {isResultVerificationMode ? (
                <div className={resultStyles.reviewGrid}>
                  <div className={`${resultStyles.reviewItem} ${resultStyles.proposed}`}>
                    <span>Raspuns ales</span>
                    <strong>
                      {row.proposedIndex !== null && row.proposedIndex !== undefined
                        ? `${answerLabel(row.proposedIndex)}. ${row.question.answers[row.proposedIndex]}`
                        : "Fara raspuns propus"}
                    </strong>
                  </div>
                  <div
                    className={`${resultStyles.reviewItem} ${
                      row.selectedTruth === true
                        ? resultStyles.positive
                        : row.selectedTruth === false
                          ? resultStyles.negative
                          : resultStyles.muted
                    }`}
                  >
                    <span>Tu ai spus</span>
                    <strong>
                      {row.selectedTruth === true ? "Corect" : row.selectedTruth === false ? "Gresit" : "Fara raspuns"}
                    </strong>
                  </div>
                  <div
                    className={`${resultStyles.reviewItem} ${
                      row.proposedIndex === row.question.correctIndex ? resultStyles.positive : resultStyles.negative
                    }`}
                  >
                    <span>De fapt era</span>
                    <strong>{row.proposedIndex === row.question.correctIndex ? "Corect" : "Gresit"}</strong>
                  </div>
                  <div className={`${resultStyles.reviewItem} ${resultStyles.correctAnswer}`}>
                    <span>Raspuns corect</span>
                    <strong>{`${answerLabel(row.question.correctIndex)}. ${row.question.answers[row.question.correctIndex]}`}</strong>
                  </div>
                </div>
              ) : (
                <div className={resultStyles.reviewGrid}>
                  <div className={`${resultStyles.reviewItem} ${resultStyles.negative}`}>
                    <span>Raspunsul tau</span>
                    <strong>
                      {row.selectedIndex !== null && row.selectedIndex !== undefined
                        ? `${answerLabel(row.selectedIndex)}. ${row.question.answers[row.selectedIndex]}`
                        : "Fara raspuns"}
                    </strong>
                  </div>
                  <div className={`${resultStyles.reviewItem} ${resultStyles.correctAnswer}`}>
                    <span>Raspuns corect</span>
                    <strong>{`${answerLabel(row.question.correctIndex)}. ${row.question.answers[row.question.correctIndex]}`}</strong>
                  </div>
                </div>
              )}
              {row.question.explanation ? (
                <div className="study-explanation">
                  <strong>Explicatie</strong>
                  <p>{row.question.explanation}</p>
                </div>
              ) : null}
            </>
          )}
          emptyMessage={
            isResultVerificationMode
              ? "Nu ai ratat nicio verificare in aceasta runda."
              : "Nu ai gresit nicio intrebare in aceasta runda."
          }
          actions={
            <>
              <Button
                variant="secondary"
                disabled={!mistakeIds.length}
                onClick={() => startQuiz(mistakeIds.length, "mistakes")}
              >
                Repeta greselile
              </Button>
              <Button onClick={repeatCurrentTest}>Repeta testul</Button>
              <Button variant="secondary" onClick={startAnotherTest}>Mai fa un test</Button>
              <Button variant="secondary" onClick={() => goToModes()}>Inapoi la moduri</Button>
            </>
          }
          insights={
            <>
              <CommunityComparisonPanel
                stats={communityStats}
                status={communityStatsStatus}
                error={communityStatsError}
              />
              <GamificationResultPanel result={gamificationResult} />
            </>
          }
        />
      ) : null}
    </section>
  );
}
