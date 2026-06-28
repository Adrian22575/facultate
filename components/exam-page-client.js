"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  BookOpen,
  CheckCircle2,
  RotateCcw,
  SlidersHorizontal,
  Trophy,
  Users,
  XCircle,
  Zap
} from "lucide-react";

import { GamificationResultPanel } from "@/components/gamification-result-panel";
import { QuestionCorrectionButton } from "@/components/question-correction-button";
import { buildLicentaQuestionKey } from "@/lib/licenta-exam-question-key";
import { shuffleArray } from "@/lib/quiz";

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

function getResultMessage(percentage) {
  if (percentage > 80) {
    return "Esti bine. Continua sa repeti ca sa fixezi.";
  }

  if (percentage >= 50) {
    return "E decent, dar mai ai zone de consolidat.";
  }

  return "Mai ai de repetat. Incepe cu greselile.";
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

  return `${stats.userRank} / ${stats.participantCount}`;
}

function CommunityComparisonPanel({ stats, status, error }) {
  if (status === "saving") {
    return (
      <section className="licenta-community-panel is-loading" aria-live="polite">
        <div className="licenta-community-panel-head">
          <span className="licenta-community-panel-icon" aria-hidden="true">
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
      <section className="licenta-community-panel is-muted" aria-live="polite">
        <div className="licenta-community-panel-head">
          <span className="licenta-community-panel-icon" aria-hidden="true">
            <BarChart3 />
          </span>
          <div>
            <h3>Comparatia nu este disponibila acum</h3>
            <p>{error || "Rezultatul tau ramane calculat local. Incearca din nou la urmatoarea runda."}</p>
          </div>
        </div>
        <Link className="btn-link secondary licenta-community-stats-link" href="/statistici">
          Vezi statistici
        </Link>
      </section>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <section className="licenta-community-panel" aria-label="Comparatie cu comunitatea">
      <div className="licenta-community-panel-head">
        <span className="licenta-community-panel-icon" aria-hidden="true">
          <Users />
        </span>
        <div>
          <h3>Comparatie cu comunitatea ta</h3>
          <p>
            Date anonime din {stats.scopeLabel || "comunitatea ta"}: {stats.attemptCount} incercari de la{" "}
            {stats.participantCount} utilizatori.
          </p>
        </div>
      </div>

      <div className="licenta-community-stat-grid">
        <div>
          <span>Scorul tau</span>
          <strong>{`${stats.userLatestScore}%`}</strong>
        </div>
        <div>
          <span>Media comunitatii</span>
          <strong>{`${stats.averageScore}%`}</strong>
        </div>
        <div>
          <span>Peste rezultate</span>
          <strong>{Number.isInteger(stats.percentile) ? `${stats.percentile}%` : "In curs"}</strong>
        </div>
        <div>
          <span>Clasare anonima</span>
          <strong>{formatRank(stats)}</strong>
        </div>
      </div>

      <div className="licenta-community-bars" aria-label="Distributia scorurilor">
        {stats.distribution?.map((bucket) => (
          <div key={bucket.key} className="licenta-community-bar-row">
            <span>{bucket.label}</span>
            <div className="licenta-community-bar-track">
              <div style={{ width: `${Math.max(bucket.percent, bucket.count ? 8 : 0)}%` }} />
            </div>
            <strong>{bucket.count}</strong>
          </div>
        ))}
      </div>
      <div className="licenta-community-footer">
        <p>Urmareste evolutia, topul comunitatii si zonele slabe in pagina dedicata.</p>
        <Link className="btn-link secondary licenta-community-stats-link" href="/statistici">
          Vezi statistici
        </Link>
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
  const [resultSummary, setResultSummary] = useState(null);
  const [communityStats, setCommunityStats] = useState(null);
  const [communityStatsStatus, setCommunityStatsStatus] = useState("idle");
  const [communityStatsError, setCommunityStatsError] = useState("");
  const [gamificationResult, setGamificationResult] = useState(null);
  const [quizValidationMessage, setQuizValidationMessage] = useState("");
  const attemptKeyRef = useRef("");
  const finishingRef = useRef(false);

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
      <section className="surface exam-empty-state">
        <div className="exam-empty-state-copy">
          <span className="step-eyebrow">Pregatire licenta</span>
          <h2>Nu exista inca grile de licenta</h2>
          <p>
            Incarca un PDF sau un fisier cu grilele din care platforma sa invete, iar dupa
            publicare intrebarile vor intra direct in pregatirea generala de licenta.
          </p>
        </div>

        <div className="exam-empty-state-actions">
          <Link className="btn-link job-primary-cta" href="/materiale?examType=licenta">
            Incarca grilele de licenta
          </Link>
          <Link className="btn-link secondary" href="/">
            Inapoi la dashboard
          </Link>
        </div>
      </section>
    );
  }

  const activeModeCopy = activeMode ? MODE_COPY[activeMode] : null;
  const isVerificationMode = activeMode === "verify";
  const isResultVerificationMode = resultSummary?.mode === "verify";
  const answeredCount = answers.filter((answer) => answer !== null).length;
  const hasAnsweredAllQuestions = answeredCount === currentQuestions.length;
  const browseQuestion = currentQuestions[browseIndex];

  return (
    <section className="licenta-prep">
      {phase === "modes" ? (
        <>
          <section className="licenta-prep-summary surface">
            <div>
              <span className="ui-section-label">Pregatire licenta</span>
              <h2>Alege modul potrivit pentru sesiunea de azi.</h2>
              <p className="page-copy">
                Sunt disponibile {preparedQuestions.length} intrebari din {subjectCount} surse. Greseli salvate:{" "}
                <strong>{mistakeIds.length}</strong>.
              </p>
            </div>
            <div className="licenta-prep-summary-badge" aria-hidden="true">
              <Trophy />
            </div>
          </section>

          {notice ? <div className="licenta-prep-notice">{notice}</div> : null}

          <div className="licenta-prep-mode-grid" aria-label="Moduri pregatire licenta">
            {["quick", "custom", "mistakes", "verify", "browse"].map((mode) => {
              const copy = MODE_COPY[mode];
              const Icon = copy.icon;
              const isBrowse = mode === "browse";

              return (
                <article
                  key={mode}
                  className={`licenta-prep-mode-card${isBrowse ? " is-wide" : ""}`}
                >
                  <div className="licenta-prep-mode-icon" aria-hidden="true">
                    <Icon />
                  </div>
                  <div className="licenta-prep-mode-copy">
                    <h2>{copy.title}</h2>
                    <p>{copy.description}</p>
                  </div>
                  <button
                    type="button"
                    className={mode === "mistakes" ? "secondary" : ""}
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
                  </button>
                </article>
              );
            })}
          </div>
        </>
      ) : null}

      {phase === "custom-select" ? (
        <section className="surface licenta-prep-panel">
          <div className="licenta-prep-panel-head">
            <div>
              <span className="ui-section-label">Antrenament personalizat</span>
              <h2>Alege cate intrebari vrei sa faci acum.</h2>
              <p className="page-copy">
                Daca alegi mai multe intrebari decat exista disponibile, folosim toate intrebarile.
              </p>
            </div>
            <button type="button" className="btn-link secondary" onClick={() => goToModes()}>
              Inapoi la moduri
            </button>
          </div>

          <div className="licenta-prep-count-grid">
            {CUSTOM_OPTIONS.map((count) => (
              <button key={count} type="button" onClick={() => startQuiz(count, "custom")}>
                {count} intrebari
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {phase === "quiz" ? (
        <>
          <section className="result-box exam-info licenta-prep-running-bar">
            <div className="exam-info-row">
              <div>
                <div className="exam-info-title">{activeModeCopy?.title || "Test licenta"}</div>
                <div className="exam-info-meta">
                  {isVerificationMode
                    ? `Intrebari: ${currentQuestions.length} | Verificate: ${answeredCount} | Neverificate: ${currentQuestions.length - answeredCount}`
                    : `Intrebari: ${currentQuestions.length} | Raspunse: ${answeredCount} | Neraspunse: ${currentQuestions.length - answeredCount}`}
                </div>
              </div>
              <div className="licenta-prep-actions">
                <button type="button" className="secondary" onClick={() => goToModes()}>
                  Inapoi la moduri
                </button>
              </div>
            </div>
          </section>

          <div className="licenta-prep-question-list">
            {currentQuestions.map((question, index) => (
              <article key={`${question.stableId}-${index}`} className="question licenta-prep-question">
                <div className="question-inline-head">
                  <div className="question-title">
                    <span>{`${index + 1}. `}</span>
                    <span className="question-rich-text">{question.text}</span>
                  </div>
                  <QuestionCorrectionButton question={question} onSaved={applySavedCorrection} />
                </div>
                <div className="meta">{question.subjectTitle ? `Materia: ${question.subjectTitle}` : "Licenta"}</div>
                {isVerificationMode ? (
                  <>
                    <div className="answers licenta-prep-answers licenta-prep-answers-check">
                      {question.answers.map((answer, answerIndex) => (
                        <div
                          key={`${question.stableId}-verify-${answerIndex}`}
                          className={
                            answerIndex === question.proposedIndex
                              ? "licenta-prep-answer-row is-proposed"
                              : "licenta-prep-answer-row"
                          }
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
                    <div className="licenta-prep-truth-actions" aria-label="Alege daca raspunsul propus este corect">
                      <button
                        type="button"
                        aria-pressed={answers[index] === true}
                        className={`secondary licenta-prep-truth-button is-correct-choice${answers[index] === true ? " is-selected" : ""}`}
                        onClick={() => answerVerificationQuestion(index, true)}
                      >
                        Corect
                      </button>
                      <button
                        type="button"
                        aria-pressed={answers[index] === false}
                        className={`secondary licenta-prep-truth-button is-wrong-choice${answers[index] === false ? " is-selected" : ""}`}
                        onClick={() => answerVerificationQuestion(index, false)}
                      >
                        Gresit
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="answers licenta-prep-answers">
                    {question.answers.map((answer, answerIndex) => (
                      <label
                        key={`${question.stableId}-${answerIndex}`}
                        className={answers[index] === answerIndex ? "is-selected" : ""}
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

          <section className="surface licenta-prep-finish-panel" aria-label="Finalizeaza runda">
            <div>
              <span className="ui-section-label">Runda aproape gata</span>
              <h2>Ai ajuns la finalul intrebarilor.</h2>
              <p className="page-copy">
                {isVerificationMode
                  ? `Ai verificat ${answeredCount} din ${currentQuestions.length} raspunsuri propuse. Poti vedea rezultatul acum sau te poti intoarce la moduri.`
                  : `Ai raspuns la ${answeredCount} din ${currentQuestions.length} intrebari. Poti vedea rezultatul acum sau te poti intoarce la moduri.`}
              </p>
              {quizValidationMessage ? (
                <p className="quiz-answer-required" role="alert">{quizValidationMessage}</p>
              ) : null}
            </div>
            <div className="licenta-prep-actions">
              <button type="button" className="secondary" onClick={() => goToModes()}>
                Inapoi la moduri
              </button>
              <button
                type="button"
                className={!hasAnsweredAllQuestions ? "is-disabled-soft" : ""}
                onClick={finishQuiz}
              >
                Vezi rezultatul
              </button>
            </div>
          </section>
        </>
      ) : null}

      {phase === "browse" && browseQuestion ? (
        <section className="surface licenta-prep-browse">
          <div className="licenta-prep-panel-head">
            <div>
              <span className="ui-section-label">Parcurge intrebarile</span>
              <h2>{`Intrebarea ${browseIndex + 1} din ${currentQuestions.length}`}</h2>
              <p className="page-copy">
                Raspunsul corect este ascuns pana cand alegi sa il vezi.
              </p>
            </div>
            <button type="button" className="btn-link secondary" onClick={() => goToModes()}>
              Inapoi la moduri
            </button>
          </div>

          <article className="question licenta-prep-question">
            <div className="question-inline-head">
              <div className="question-title">
                <span className="question-rich-text">{browseQuestion.text}</span>
              </div>
              <QuestionCorrectionButton question={browseQuestion} onSaved={applySavedCorrection} />
            </div>
            <div className="meta">
              {browseQuestion.subjectTitle ? `Materia: ${browseQuestion.subjectTitle}` : "Licenta"}
            </div>
            <div className="answers licenta-prep-answers is-review">
              {browseQuestion.answers.map((answer, answerIndex) => (
                <div
                  key={`${browseQuestion.stableId}-browse-${answerIndex}`}
                  className={
                    showBrowseAnswer && answerIndex === browseQuestion.correctIndex
                      ? "licenta-prep-answer-row is-correct"
                      : "licenta-prep-answer-row"
                  }
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

          <div className="licenta-prep-actions">
            <button
              type="button"
              className="secondary"
              disabled={browseIndex === 0}
              onClick={goToPreviousBrowseQuestion}
            >
              Intrebarea anterioara
            </button>
            {!showBrowseAnswer ? (
              <button type="button" onClick={() => setShowBrowseAnswer(true)}>
                Arata raspunsul
              </button>
            ) : (
              <button type="button" onClick={goToNextBrowseQuestion}>
                {browseIndex === currentQuestions.length - 1 ? "Incheie parcurgerea" : "Urmatoarea"}
              </button>
            )}
          </div>
        </section>
      ) : null}

      {phase === "result" && resultSummary ? (
        <section className="result-box licenta-prep-result">
          <div className="licenta-prep-result-head">
            <span className="licenta-prep-result-icon" aria-hidden="true">
              {resultSummary.percentage > 80 ? <CheckCircle2 /> : <XCircle />}
            </span>
            <div>
              <h2>Rezultat final</h2>
              <p>{getResultMessage(resultSummary.percentage)}</p>
            </div>
          </div>

          <div className="licenta-prep-score-grid">
            <div>
              <span>Scor</span>
              <strong>{`${resultSummary.score} din ${resultSummary.total}`}</strong>
            </div>
            <div>
              <span>Procent</span>
              <strong>{`${resultSummary.percentage}%`}</strong>
            </div>
            <div>
              <span>Greseli salvate</span>
              <strong>{mistakeIds.length}</strong>
            </div>
          </div>

          <CommunityComparisonPanel
            stats={communityStats}
            status={communityStatsStatus}
            error={communityStatsError}
          />
          <GamificationResultPanel result={gamificationResult} />

          <hr className="result-divider" />
          <h3>{isResultVerificationMode ? "Verificari gresite" : "Intrebari gresite"}</h3>

          {resultSummary.wrongQuestions.length ? (
            <div className="licenta-prep-wrong-list">
              {resultSummary.wrongQuestions.map(({ question, selectedIndex, selectedTruth, proposedIndex }, index) => (
                <article key={`${question.stableId}-wrong-${index}`} className="result-detail">
                  <strong>{`${index + 1}. ${question.text}`}</strong>
                  {getResultSubjectMeta(question) ? (
                    <div className="result-meta">{getResultSubjectMeta(question)}</div>
                  ) : null}
                  {isResultVerificationMode ? (
                    <div className="licenta-result-review-grid">
                      <div className="licenta-result-review-item is-proposed">
                        <span>Raspuns ales</span>
                        <strong>
                          {proposedIndex !== null && proposedIndex !== undefined
                            ? `${answerLabel(proposedIndex)}. ${question.answers[proposedIndex]}`
                            : "Fara raspuns propus"}
                        </strong>
                      </div>
                      <div
                        className={`licenta-result-review-item ${
                          selectedTruth === true ? "is-positive" : selectedTruth === false ? "is-negative" : "is-muted"
                        }`}
                      >
                        <span>Tu ai spus</span>
                        <strong>
                          {selectedTruth === true ? "Corect" : selectedTruth === false ? "Gresit" : "Fara raspuns"}
                        </strong>
                      </div>
                      <div
                        className={`licenta-result-review-item ${
                          proposedIndex === question.correctIndex ? "is-positive" : "is-negative"
                        }`}
                      >
                        <span>De fapt era</span>
                        <strong>{proposedIndex === question.correctIndex ? "Corect" : "Gresit"}</strong>
                      </div>
                      <div className="licenta-result-review-item is-correct-answer">
                        <span>Raspuns corect</span>
                        <strong>{`${answerLabel(question.correctIndex)}. ${question.answers[question.correctIndex]}`}</strong>
                      </div>
                    </div>
                  ) : (
                    <div className="licenta-result-review-grid">
                      <div className="licenta-result-review-item is-negative">
                        <span>Raspunsul tau</span>
                        <strong>
                          {selectedIndex !== null && selectedIndex !== undefined
                            ? `${answerLabel(selectedIndex)}. ${question.answers[selectedIndex]}`
                            : "Fara raspuns"}
                        </strong>
                      </div>
                      <div className="licenta-result-review-item is-correct-answer">
                        <span>Raspuns corect</span>
                        <strong>{`${answerLabel(question.correctIndex)}. ${question.answers[question.correctIndex]}`}</strong>
                      </div>
                    </div>
                  )}
                  {question.explanation ? (
                    <div className="study-explanation">
                      <strong>Explicatie</strong>
                      <p>{question.explanation}</p>
                    </div>
                  ) : null}
                  <div className="result-correction-actions">
                    <QuestionCorrectionButton
                      question={question}
                      label="Corecteaza intrebarea"
                      onSaved={applySavedCorrection}
                    />
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="page-copy">
              {isResultVerificationMode
                ? "Nu ai ratat nicio verificare in aceasta runda."
                : "Nu ai gresit nicio intrebare in aceasta runda."}
            </p>
          )}

          <div className="licenta-prep-actions licenta-prep-result-actions">
            <button
              type="button"
              className="secondary"
              disabled={!mistakeIds.length}
              onClick={() => startQuiz(mistakeIds.length, "mistakes")}
            >
              Repeta greselile
            </button>
            <button type="button" onClick={repeatCurrentTest}>
              Repeta testul
            </button>
            <button type="button" className="secondary" onClick={startAnotherTest}>
              Mai fa un test
            </button>
            <button type="button" className="secondary" onClick={() => goToModes()}>
              Inapoi la moduri
            </button>
          </div>
        </section>
      ) : null}
    </section>
  );
}
