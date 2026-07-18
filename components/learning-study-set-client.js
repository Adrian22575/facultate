"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, BookOpen, Brain, CheckCircle2, ListChecks, LoaderCircle, RotateCcw, Target, Trash2, XCircle } from "lucide-react";

import {
  deleteLearningStudySetAction,
  publishLearningStudySetAction,
  reportLearningStudySetAction,
  retryLearningStudySetAction,
  saveLearningFlashcardRatingAction,
  saveLearningQuizAttemptAction
} from "@/app/ai/invata/actions";
import { GamificationResultPanel } from "@/components/gamification-result-panel";
import { ProcessingStageTracker } from "@/components/processing-stage-tracker";
import { shuffleArray } from "@/lib/quiz";
import { saveLastSession } from "@/lib/session-storage";
import { handleTablistKeyDown } from "@/lib/ui/tablist";

const TABS = [
  { id: "overview", label: "Incepe" },
  { id: "chapters", label: "Capitole" },
  { id: "flashcards", label: "Flashcards" },
  { id: "test", label: "Testeaza-te" },
  { id: "simulation", label: "Simulare" },
  { id: "competition", label: "Clasament" },
  { id: "mistakes", label: "Greseli" },
  { id: "plan", label: "Plan" }
];
const PRIMARY_TAB_IDS = new Set(["overview", "flashcards", "test"]);
const PRIMARY_TABS = TABS.filter((tab) => PRIMARY_TAB_IDS.has(tab.id));
const MORE_TABS = TABS.filter((tab) => !PRIMARY_TAB_IDS.has(tab.id));
const PROCESSING_STUDY_SET_STATUSES = new Set([
  "draft",
  "uploaded",
  "extracting",
  "outlining",
  "generating",
  "consolidating"
]);

function createAttemptKey() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function LearningDeleteControl({ isOpen, isDeleting, message, onOpen, onCancel, onConfirm }) {
  if (!isOpen) {
    return (
      <button
        type="button"
        className="secondary learning-delete-open"
        data-usage-event="learning_set_delete_opened"
        onClick={onOpen}
      >
        <Trash2 aria-hidden="true" size={17} />
        Sterge materialul
      </button>
    );
  }

  return (
    <div className="learning-delete-confirmation" role="alert">
      <span>Se vor sterge materialul, progresul si publicarea lui.</span>
      <div>
        <button type="button" className="secondary" disabled={isDeleting} onClick={onCancel}>
          Renunta
        </button>
        <button type="button" className="learning-delete-confirm" disabled={isDeleting} onClick={onConfirm}>
          {isDeleting ? "Se sterge..." : "Sterge definitiv"}
        </button>
      </div>
      {message ? <p role="status">{message}</p> : null}
    </div>
  );
}

function answerLabel(index) {
  return String.fromCharCode(65 + index);
}

function normalizeQuestions(questions) {
  return questions.filter((question) => Array.isArray(question.answers) && question.answers.length >= 2);
}

function formatShortDate(value) {
  if (!value) return "fara data";
  try {
    return new Intl.DateTimeFormat("ro-RO", {
      day: "2-digit",
      month: "short"
    }).format(new Date(value));
  } catch {
    return "fara data";
  }
}

function buildSimulation(chapters, questions, variant = 0) {
  const usableQuestionsSource = normalizeQuestions(questions);
  const usableQuestions = (variant ? shuffleArray(usableQuestionsSource) : usableQuestionsSource).slice(0, 6);
  const conceptSource = chapters.flatMap((chapter) =>
    chapter.concepts.map((concept) => ({
      ...concept,
      chapterTitle: chapter.title
    }))
  );
  const concepts = variant ? shuffleArray(conceptSource) : conceptSource;

  const trueFalseQuestions = concepts.slice(0, 6).map((concept, index) => {
    const pair = concepts[(index + 1) % concepts.length] || concept;
    const shouldBeTrue = index % 2 === 0 || concepts.length < 2;
    const statement = shouldBeTrue
      ? `${concept.title} este legat de: ${concept.simpleExplanation}`
      : `${concept.title} este legat de: ${pair.simpleExplanation}`;
    return {
      id: `tf-${concept.id}-${index}`,
      statement,
      chapterTitle: concept.chapterTitle,
      correct: shouldBeTrue,
      explanation: shouldBeTrue
        ? concept.simpleExplanation
        : `Raspunsul corect este fals. Conceptul "${concept.title}" se explica astfel: ${concept.simpleExplanation}`
    };
  });

  const shortAnswerQuestions = concepts.slice(0, 4).map((concept, index) => ({
    id: `open-${concept.id}-${index}`,
    question: `Explica pe scurt conceptul: ${concept.title}`,
    chapterTitle: concept.chapterTitle,
    modelAnswer: concept.simpleExplanation,
    example: concept.example
  }));

  return {
    multipleChoice: usableQuestions,
    trueFalse: trueFalseQuestions,
    shortAnswer: shortAnswerQuestions
  };
}

function KpiCard({ label, value, detail }) {
  return (
    <article className="learning-kpi-card">
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <p>{detail}</p> : null}
    </article>
  );
}

function isProcessingStudySet(studySet) {
  if (PROCESSING_STUDY_SET_STATUSES.has(studySet.status)) return true;
  return studySet.processingJob?.status === "pending" || studySet.processingJob?.status === "processing";
}

function LearningProcessingPanel({ studySet }) {
  const router = useRouter();
  const [jobSnapshot, setJobSnapshot] = useState(studySet.processingJob || null);
  const [message, setMessage] = useState("");
  const [terminalStatus, setTerminalStatus] = useState(null);
  const jobId = studySet.jobId || studySet.processingJob?.id || null;
  const processingStage = jobSnapshot?.stage || studySet.status;
  const statusDetail =
    jobSnapshot?.statusDetail ||
    (studySet.status === "uploaded"
      ? "Materia a fost incarcata. Pregatim procesarea."
      : "Pregatim materialele de invatare.");

  useEffect(() => {
    if (!jobId) return undefined;
    if (jobSnapshot?.status === "succeeded" || jobSnapshot?.status === "failed") return undefined;

    let isCancelled = false;
    let timeoutId = null;
    let inFlight = false;
    let continuePolling = true;

    async function processTick() {
      if (inFlight) return;
      inFlight = true;
      try {
        const response = await fetch(`/api/materiale/jobs/${jobId}/process`, {
          method: "POST",
          credentials: "same-origin",
          headers: {
            Accept: "application/json"
          }
        });
        const payload = await response.json().catch(() => null);
        if (!isCancelled && response.ok && payload) {
          setJobSnapshot(payload);
          if (payload.status === "succeeded") {
            continuePolling = false;
            setTerminalStatus("succeeded");
            setMessage("Materia este gata de invatat.");
            return;
          }
          if (payload.status === "failed") {
            continuePolling = false;
            setTerminalStatus("failed");
            setMessage("Procesarea s-a oprit.");
            return;
          }
        }
      } catch {
        if (!isCancelled) {
          setMessage("Procesarea continua. Daca pagina nu se actualizeaza, revino din Activitate.");
        }
      } finally {
        inFlight = false;
        if (!isCancelled && continuePolling) {
          timeoutId = window.setTimeout(processTick, 2600);
        }
      }
    }

    timeoutId = window.setTimeout(processTick, 350);
    return () => {
      isCancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [jobId, jobSnapshot?.status]);

  if (terminalStatus) {
    const succeeded = terminalStatus === "succeeded";

    return (
      <section className={`learning-processing-result ${succeeded ? "is-success" : "is-error"}`} role="status">
        <span className="ui-section-label">{succeeded ? "Material gata" : "Procesare oprita"}</span>
        <h1>{succeeded ? "Poti incepe sa inveti." : "Materialul este pastrat."}</h1>
        <p>
          {succeeded
            ? "Au fost pregatite capitole, flashcarduri si teste pentru materia ta."
            : "Deschide materialul pentru a vedea optiunile disponibile de reluare."}
        </p>
        <button type="button" className="btn-link" onClick={() => router.refresh()}>
          {succeeded ? "Deschide materialul" : "Vezi optiunile"}
        </button>
      </section>
    );
  }

  return (
    <section className="learning-processing-view" aria-busy="true">
      <div className="learning-processing-hero">
        <LoaderCircle aria-hidden="true" />
        <div>
          <span className="ui-section-label">Procesare</span>
          <h1>{studySet.title}</h1>
          <p role="status" aria-live="polite" aria-atomic="true">{message || statusDetail}</p>
        </div>
      </div>

      <ProcessingStageTracker kind="learning" stage={processingStage} status={jobSnapshot?.status} />

      <p className="learning-processing-note">
        Poți reveni oricând din Activitate. Materialul este păstrat și nu trebuie încărcat din nou.
      </p>

      <div className="learning-study-footer">
        <Link className="btn-link secondary" href="/materiale/activitate">
          Vezi activitatea
        </Link>
      </div>
    </section>
  );
}

function ChapterCard({ chapter, onStartChapterTest }) {
  return (
    <article className="learning-chapter-card">
      <div className="learning-chapter-head">
        <span>{`Capitolul ${chapter.position}`}</span>
        <h3>{chapter.title}</h3>
      </div>
      <p>{chapter.summary}</p>
      {chapter.keyIdeas.length ? (
        <ul className="learning-idea-list">
          {chapter.keyIdeas.slice(0, 3).map((idea) => (
            <li key={idea}>{idea}</li>
          ))}
        </ul>
      ) : null}
      <div className="learning-term-row">
        {chapter.keyTerms.slice(0, 5).map((term) => (
          <span key={term}>{term}</span>
        ))}
      </div>
      {chapter.concepts.length ? (
        <div className="learning-concept-list">
          {chapter.concepts.slice(0, 4).map((concept) => (
            <details key={concept.id}>
              <summary>{concept.title}</summary>
              <p>{concept.simpleExplanation}</p>
              {concept.example ? <small>{`Exemplu: ${concept.example}`}</small> : null}
              {concept.analogy ? <small>{`Pe scurt: ${concept.analogy}`}</small> : null}
              {concept.checkQuestion ? <em>{concept.checkQuestion}</em> : null}
            </details>
          ))}
        </div>
      ) : null}
      <div className="learning-chapter-actions">
        <button type="button" className="secondary" onClick={() => onStartChapterTest(chapter.id)}>
          Test capitol
        </button>
      </div>
    </article>
  );
}

function FlashcardsTab({ studySetId, flashcards }) {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [ratings, setRatings] = useState(() =>
    Object.fromEntries(
      flashcards
        .filter((flashcard) => flashcard.review?.rating)
        .map((flashcard) => [flashcard.id, flashcard.review.rating])
    )
  );
  const [saveMessage, setSaveMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const current = flashcards[index] || null;
  const weakCount = Object.values(ratings).filter((rating) => rating === "nu_stiu" || rating === "aproape").length;

  async function rateCurrent(rating) {
    if (!current) return;
    setRatings((value) => ({ ...value, [current.id]: rating }));
    setSaveMessage("");
    setRevealed(false);
    setIndex((value) => Math.min(value + 1, flashcards.length));
    setIsSaving(true);
    try {
      const result = await saveLearningFlashcardRatingAction({
        studySetId,
        flashcardId: current.id,
        rating
      });
      if (!result.ok) {
        setSaveMessage(result.error || "Nu am putut salva ratingul.");
        return;
      }
      setSaveMessage("Rating salvat.");
    } finally {
      setIsSaving(false);
    }
  }

  if (!flashcards.length) {
    return <div className="learning-empty-panel">Nu avem flashcards pentru aceasta materie.</div>;
  }

  if (!current) {
    return (
      <section className="learning-finish-panel">
        <CheckCircle2 aria-hidden="true" />
        <div>
          <h3>Sesiune terminata</h3>
          <p>{weakCount ? `${weakCount} carduri merita repetate.` : "Toate cardurile au mers bine."}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setIndex(0);
            setRevealed(false);
          }}
        >
          Reia flashcards
        </button>
      </section>
    );
  }

  return (
    <section className="learning-flashcards-shell">
      <div className="learning-session-head">
        <span>{`${index + 1} / ${flashcards.length}`}</span>
        <strong>{isSaving ? "Salvam progresul..." : current.hint || "Flashcards"}</strong>
      </div>
      <button
        type="button"
        className={`learning-flashcard ${revealed ? "is-revealed" : ""}`}
        onClick={() => setRevealed((value) => !value)}
      >
        <span>{revealed ? "Raspuns" : "Intrebare"}</span>
        <strong>{revealed ? current.back : current.front}</strong>
        <small>{revealed ? "Apasa un rating mai jos." : "Apasa pe card ca sa vezi raspunsul."}</small>
      </button>
      <div className="learning-flashcard-actions">
        <button
          type="button"
          className="secondary"
          data-usage-event="learning_flashcard_rated"
          data-usage-label="Nu stiu"
          disabled={isSaving}
          onClick={() => rateCurrent("nu_stiu")}
        >
          Nu stiu
        </button>
        <button
          type="button"
          className="secondary"
          data-usage-event="learning_flashcard_rated"
          data-usage-label="Aproape"
          disabled={isSaving}
          onClick={() => rateCurrent("aproape")}
        >
          Aproape
        </button>
        <button
          type="button"
          data-usage-event="learning_flashcard_rated"
          data-usage-label="Stiu"
          disabled={isSaving}
          onClick={() => rateCurrent("stiu")}
        >
          Stiu
        </button>
        <button
          type="button"
          className="secondary"
          data-usage-event="learning_flashcard_rated"
          data-usage-label="Mai tarziu"
          disabled={isSaving}
          onClick={() => rateCurrent("mai_tarziu")}
        >
          Mai tarziu
        </button>
      </div>
      {saveMessage ? <p className="learning-save-message" role="status">{saveMessage}</p> : null}
    </section>
  );
}

function TestTab({
  studySetId,
  questions,
  mistakeQuestions,
  chapterId = "all",
  testMode = "all",
  onChapterChange,
  onTestModeChange,
  onMistakes
}) {
  const [questionLimit, setQuestionLimit] = useState(10);
  const [difficulty, setDifficulty] = useState("all");
  const questionPool = useMemo(() => {
    const sourceQuestions = testMode === "mistakes" ? mistakeQuestions : questions;
    const safeQuestions = normalizeQuestions(sourceQuestions);
    const chapterQuestions =
      testMode === "mistakes" || chapterId === "all"
        ? safeQuestions
        : safeQuestions.filter((question) => question.chapterId === chapterId);
    const difficultyQuestions =
      difficulty === "all"
        ? chapterQuestions
        : chapterQuestions.filter((question) => question.difficulty === difficulty);
    return difficultyQuestions;
  }, [chapterId, difficulty, mistakeQuestions, questionLimit, questions, testMode]);
  const defaultQuestions = useMemo(
    () => questionPool.slice(0, questionLimit),
    [questionPool, questionLimit]
  );
  const [questionSession, setQuestionSession] = useState([]);
  const activeQuestions = questionSession.length ? questionSession : defaultQuestions;
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const attemptKeyRef = useRef("");
  const unansweredCount = activeQuestions.filter((question) => answers[question.id] === undefined).length;
  const answeredCount = activeQuestions.length - unansweredCount;

  function resetTest() {
    setAnswers({});
    setResult(null);
    attemptKeyRef.current = "";
  }

  function resetSelection() {
    setQuestionSession([]);
    resetTest();
  }

  function startAnotherTest() {
    const nextQuestions = shuffleArray(questionPool).slice(0, Math.min(questionLimit, questionPool.length));
    setQuestionSession(nextQuestions);
    resetTest();
  }

  function startMistakesReview() {
    onTestModeChange("mistakes");
    setQuestionSession([]);
    setDifficulty("all");
    resetTest();
  }

  async function finishTest() {
    if (unansweredCount) {
      setResult({ type: "warning", message: `Mai ai ${unansweredCount} intrebari fara raspuns.` });
      return;
    }

    const submittedAnswers = activeQuestions.map((question) => ({
      questionId: question.id,
      selectedIndex: answers[question.id]
    }));
    const idempotencyKey = attemptKeyRef.current || createAttemptKey();
    attemptKeyRef.current = idempotencyKey;
    setResult({ type: "saving", message: "Salvam rezultatul testului..." });
    setIsSaving(true);
    try {
      const saved = await saveLearningQuizAttemptAction({
        studySetId,
        chapterId: testMode === "mistakes" ? "mistakes" : chapterId,
        idempotencyKey,
        answers: submittedAnswers
      });

      if (!saved.ok) {
        setResult({
          type: "warning",
          message: saved.error || "Nu am putut salva rezultatul testului."
        });
        return;
      }

      const wrong = (saved.result?.wrong || []).map((wrongQuestion) => {
        const localQuestion = activeQuestions.find((question) => question.id === wrongQuestion.id);
        return {
          ...wrongQuestion,
          chapterTitle: localQuestion?.chapterTitle || wrongQuestion.chapterTitle || "Capitol"
        };
      });
      onMistakes(wrong);
      setResult({
        type: "done",
        score: saved.result.score,
        total: saved.result.total,
        percentage: saved.result.percentage,
        wrong,
        gamification: saved.result.gamification || null
      });
    } finally {
      setIsSaving(false);
    }
  }

  if (!activeQuestions.length) {
    return <div className="learning-empty-panel">Nu avem intrebari pentru selectia curenta.</div>;
  }

  return (
    <section className="learning-test-shell">
      <div className="learning-test-toolbar">
        <label>
          Mod
          <select
            value={testMode}
            onChange={(event) => {
              onTestModeChange(event.target.value);
              resetSelection();
            }}
          >
            <option value="all">Test rapid</option>
            {mistakeQuestions.length ? <option value="mistakes">Doar greseli</option> : null}
          </select>
        </label>
        <label>
          Capitol
          <select
            value={chapterId}
            disabled={testMode === "mistakes"}
            onChange={(event) => {
              onChapterChange(event.target.value);
              resetSelection();
            }}
          >
            <option value="all">Toate capitolele</option>
            {Array.from(new Map(questions.map((question) => [question.chapterId, question.chapterTitle || "Capitol"]))).map(
              ([id, title]) => (
                <option key={id} value={id}>
                  {title}
                </option>
              )
            )}
          </select>
        </label>
        <label>
          Numar
          <select
            value={questionLimit}
            onChange={(event) => {
              setQuestionLimit(Number(event.target.value));
              resetSelection();
            }}
          >
            {[10, 20, 30, 50].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label>
          Dificultate
          <select
            value={difficulty}
            onChange={(event) => {
              setDifficulty(event.target.value);
              resetSelection();
            }}
          >
            <option value="all">Mixt</option>
            <option value="usor">Usor</option>
            <option value="mediu">Mediu</option>
            <option value="greu">Greu</option>
          </select>
        </label>
        <span>{`${answeredCount}/${activeQuestions.length} răspunsuri`}</span>
      </div>

      <div className="learning-question-list">
        {activeQuestions.map((question, questionIndex) => (
          <article key={question.id} className="learning-question-card">
            <strong>{`${questionIndex + 1}. ${question.questionText}`}</strong>
            <div className="learning-answer-list">
              {question.answers.map((answer, answerIndex) => (
                <label
                  key={`${question.id}-${answerIndex}`}
                  className={answers[question.id] === answerIndex ? "is-selected" : ""}
                >
                  <input
                    checked={answers[question.id] === answerIndex}
                    name={`learning-q-${question.id}`}
                    type="radio"
                    onChange={() => setAnswers((value) => ({ ...value, [question.id]: answerIndex }))}
                  />
                  <span>{`${answerLabel(answerIndex)}. ${answer}`}</span>
                </label>
              ))}
            </div>
          </article>
        ))}
      </div>

      {result ? (
        <>
          <div className={`learning-test-result is-${result.type}`} role="status" aria-live="polite">
            {result.type === "warning" ? <XCircle aria-hidden="true" /> : null}
            {result.type === "saving" ? <LoaderCircle className="learning-result-spinner" aria-hidden="true" /> : null}
            {result.type === "done" ? <CheckCircle2 aria-hidden="true" /> : null}
            <div>
              <strong>
                {result.type === "warning"
                  ? result.message
                  : result.type === "saving"
                    ? result.message
                    : `Scor ${result.score} din ${result.total} (${result.percentage}%)`}
              </strong>
              {result.type === "done" ? (
                <p>
                  {result.wrong.length
                    ? "Repeta greselile si revino la capitolul slab."
                    : "Runda curata. Continua cu flashcards sau cu planul."}
                </p>
              ) : null}
            </div>
          </div>
          <GamificationResultPanel result={result.gamification} />
        </>
      ) : null}

      <div className="learning-test-actions">
        {result?.type === "done" ? (
          <>
            {result.wrong.length ? (
              <button type="button" onClick={startMistakesReview}>Repetă greșelile</button>
            ) : (
              <button type="button" onClick={startAnotherTest}>Mai fă un test</button>
            )}
            <button
              type="button"
              className="secondary"
              onClick={result.wrong.length ? startAnotherTest : resetTest}
            >
              {result.wrong.length ? "Alte întrebări" : "Repetă același test"}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              data-usage-event="learning_quiz_completed"
              data-usage-label={testMode === "mistakes" ? "Test greseli" : "Test invatare"}
              onClick={finishTest}
              disabled={isSaving}
            >
              {isSaving ? "Se salvează..." : "Vezi rezultatul"}
            </button>
            {answeredCount ? (
              <button type="button" className="secondary" disabled={isSaving} onClick={resetTest}>
                Resetează răspunsurile
              </button>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

function ExamSimulationTab({ chapters, questions }) {
  const [simulationVariant, setSimulationVariant] = useState(0);
  const simulation = useMemo(
    () => buildSimulation(chapters, questions, simulationVariant),
    [chapters, questions, simulationVariant]
  );
  const [multipleChoiceAnswers, setMultipleChoiceAnswers] = useState({});
  const [trueFalseAnswers, setTrueFalseAnswers] = useState({});
  const [shortAnswers, setShortAnswers] = useState({});
  const [result, setResult] = useState(null);

  const objectiveTotal = simulation.multipleChoice.length + simulation.trueFalse.length;
  const answeredObjectiveCount =
    Object.keys(multipleChoiceAnswers).length + Object.keys(trueFalseAnswers).length;
  const hasSimulationContent =
    simulation.multipleChoice.length || simulation.trueFalse.length || simulation.shortAnswer.length;

  function resetSimulation() {
    setMultipleChoiceAnswers({});
    setTrueFalseAnswers({});
    setShortAnswers({});
    setResult(null);
  }

  function startAnotherSimulation() {
    setSimulationVariant((value) => value + 1);
    resetSimulation();
  }

  function finishSimulation() {
    const missingObjectiveCount = objectiveTotal - answeredObjectiveCount;
    if (missingObjectiveCount > 0) {
      setResult({
        type: "warning",
        message: `Mai ai ${missingObjectiveCount} raspunsuri obligatorii in partea evaluata automat.`
      });
      return;
    }

    const multipleChoiceScore = simulation.multipleChoice.filter(
      (question) => multipleChoiceAnswers[question.id] === question.correctIndex
    ).length;
    const trueFalseScore = simulation.trueFalse.filter(
      (question) => trueFalseAnswers[question.id] === question.correct
    ).length;
    const score = multipleChoiceScore + trueFalseScore;
    const percentage = objectiveTotal ? Math.round((score / objectiveTotal) * 100) : 0;

    setResult({
      type: "done",
      score,
      total: objectiveTotal,
      percentage,
      multipleChoiceScore,
      trueFalseScore
    });
  }

  if (!hasSimulationContent) {
    return <div className="learning-empty-panel">Nu avem suficient continut pentru o simulare mixta.</div>;
  }

  return (
    <section className="learning-simulation-shell">
      <div className="learning-simulation-head">
        <div>
          <span className="ui-section-label">Simulare examen</span>
          <h2>Runda mixta</h2>
          <p>
            Grilele si adevarat/fals se evalueaza automat. Intrebarile scurte primesc raspuns model
            pentru verificare rapida.
          </p>
        </div>
        <div className="learning-simulation-score">
          <strong>{objectiveTotal}</strong>
          <span>itemi evaluati automat</span>
        </div>
      </div>

      {simulation.multipleChoice.length ? (
        <section className="learning-simulation-section">
          <h3>Subiectul 1. Grila</h3>
          <div className="learning-question-list">
            {simulation.multipleChoice.map((question, questionIndex) => (
              <article key={question.id} className="learning-question-card">
                <span className="learning-question-meta">{question.chapterTitle}</span>
                <strong>{`${questionIndex + 1}. ${question.questionText}`}</strong>
                <div className="learning-answer-list">
                  {question.answers.map((answer, answerIndex) => (
                    <label
                      key={`${question.id}-${answerIndex}`}
                      className={multipleChoiceAnswers[question.id] === answerIndex ? "is-selected" : ""}
                    >
                      <input
                        checked={multipleChoiceAnswers[question.id] === answerIndex}
                        name={`simulation-mc-${question.id}`}
                        type="radio"
                        onChange={() =>
                          setMultipleChoiceAnswers((value) => ({ ...value, [question.id]: answerIndex }))
                        }
                      />
                      <span>{`${answerLabel(answerIndex)}. ${answer}`}</span>
                    </label>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {simulation.trueFalse.length ? (
        <section className="learning-simulation-section">
          <h3>Subiectul 2. Adevarat sau fals</h3>
          <div className="learning-simulation-grid">
            {simulation.trueFalse.map((question, index) => (
              <article key={question.id} className="learning-true-false-card">
                <span className="learning-question-meta">{`${index + 1}. ${question.chapterTitle}`}</span>
                <strong>{question.statement}</strong>
                <div className="learning-binary-actions">
                  <button
                    type="button"
                    className={trueFalseAnswers[question.id] === true ? "is-selected" : ""}
                    onClick={() => setTrueFalseAnswers((value) => ({ ...value, [question.id]: true }))}
                  >
                    Adevarat
                  </button>
                  <button
                    type="button"
                    className={trueFalseAnswers[question.id] === false ? "is-selected" : ""}
                    onClick={() => setTrueFalseAnswers((value) => ({ ...value, [question.id]: false }))}
                  >
                    Fals
                  </button>
                </div>
                {result?.type === "done" ? <p>{question.explanation}</p> : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {simulation.shortAnswer.length ? (
        <section className="learning-simulation-section">
          <h3>Subiectul 3. Intrebari scurte</h3>
          <div className="learning-simulation-grid">
            {simulation.shortAnswer.map((question, index) => (
              <article key={question.id} className="learning-short-answer-card">
                <span className="learning-question-meta">{`${index + 1}. ${question.chapterTitle}`}</span>
                <label>
                  <strong>{question.question}</strong>
                  <textarea
                    value={shortAnswers[question.id] || ""}
                    rows={4}
                    placeholder="Scrie raspunsul tau..."
                    onChange={(event) =>
                      setShortAnswers((value) => ({ ...value, [question.id]: event.target.value }))
                    }
                  />
                </label>
                {result?.type === "done" ? (
                  <div className="learning-model-answer">
                    <span>Raspuns model</span>
                    <p>{question.modelAnswer}</p>
                    {question.example ? <small>{`Exemplu: ${question.example}`}</small> : null}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {result ? (
        <div className={`learning-test-result ${result.type === "warning" ? "is-warning" : "is-done"}`}>
          {result.type === "warning" ? <XCircle aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}
          <div>
            <strong>
              {result.type === "warning"
                ? result.message
                : `Scor automat ${result.score} din ${result.total} (${result.percentage}%)`}
            </strong>
            {result.type === "done" ? (
              <p>
                {`Grila: ${result.multipleChoiceScore}/${simulation.multipleChoice.length}. Adevarat/fals: ${result.trueFalseScore}/${simulation.trueFalse.length}. Verifica manual raspunsurile scurte dupa model.`}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="learning-test-actions">
        <button
          type="button"
          data-usage-event="learning_simulation_completed"
          data-usage-label="Simulare examen"
          onClick={finishSimulation}
        >
          Finalizeaza simularea
        </button>
        <button type="button" className="secondary" onClick={resetSimulation}>
          Repeta simularea
        </button>
        <button type="button" className="secondary" onClick={startAnotherSimulation}>
          Mai fa o simulare
        </button>
      </div>
    </section>
  );
}

function CompetitionTab({ leaderboard }) {
  const rows = leaderboard?.rows || [];
  const hasParticipants = Number(leaderboard?.participantCount || 0) > 0;

  if (!hasParticipants) {
    return (
      <div className="learning-empty-panel">
        Competitia apare dupa primele teste salvate pentru acest material.
      </div>
    );
  }

  return (
    <section className="learning-competition-shell">
      <div className="learning-competition-head">
        <div>
          <span className="ui-section-label">Comparatie comunitate</span>
          <h2>Leaderboard anonim</h2>
          <p>
            Comparatia foloseste doar rundele acestui material si ramane in comunitatea materialului.
            Colegii sunt anonimizati.
          </p>
        </div>
        <div className="learning-competition-kpis">
          <KpiCard
            label="Pozitia ta"
            value={leaderboard.currentUserRank ? `#${leaderboard.currentUserRank}` : "-"}
            detail={leaderboard.currentUserBestScore === null ? "fa un test" : `${leaderboard.currentUserBestScore}% cel mai bun`}
          />
          <KpiCard label="Participanti" value={leaderboard.participantCount} detail="cu teste salvate" />
          <KpiCard label="Media comunitatii" value={`${leaderboard.communityAverage}%`} detail="dupa cel mai bun scor" />
        </div>
      </div>

      <div className="learning-leaderboard-list">
        {rows.map((row) => (
          <article key={`${row.rank}-${row.label}`} className={row.isCurrentUser ? "is-current-user" : ""}>
            <span>{`#${row.rank}`}</span>
            <div>
              <strong>{row.label}</strong>
              <small>{`${row.attemptCount} runde - ultima: ${formatShortDate(row.lastAttemptAt)}`}</small>
            </div>
            <b>{`${row.bestScore}%`}</b>
          </article>
        ))}
      </div>
    </section>
  );
}

export function LearningStudySetClient({ studySet }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("overview");
  const [chapterFilter, setChapterFilter] = useState("all");
  const [testMode, setTestMode] = useState("all");
  const [mistakes, setMistakes] = useState(studySet.savedMistakes || []);
  const [publishedAt, setPublishedAt] = useState(studySet.publishedAt || null);
  const [publishMessage, setPublishMessage] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishConfirmationOpen, setPublishConfirmationOpen] = useState(false);
  const [reportMessage, setReportMessage] = useState("");
  const [isReporting, setIsReporting] = useState(false);
  const [retryMessage, setRetryMessage] = useState("");
  const [isRetrying, setIsRetrying] = useState(false);
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const questionsWithChapterTitles = useMemo(() => {
    const chapterTitleById = new Map(studySet.chapters.map((chapter) => [chapter.id, chapter.title]));
    return studySet.questions.map((question) => ({
      ...question,
      chapterTitle: chapterTitleById.get(question.chapterId) || "Capitol"
    }));
  }, [studySet.chapters, studySet.questions]);
  const nextChapter = studySet.chapters[0] || null;
  const isProcessing = isProcessingStudySet(studySet);
  const activeTabLabel = TABS.find((tab) => tab.id === activeTab)?.label || "Invatare";
  const isMoreTabActive = MORE_TABS.some((tab) => tab.id === activeTab);

  useEffect(() => {
    if (isProcessing) return;

    saveLastSession({
      subjectTitle: studySet.title,
      mode: "Material de studiu",
      url: `/materiale/invata/${studySet.id}`
    });
  }, [isProcessing, studySet.id, studySet.title]);

  function startChapterTest(chapterId) {
    setChapterFilter(chapterId);
    setTestMode("all");
    setActiveTab("test");
  }

  function startMistakesTest() {
    setChapterFilter("all");
    setTestMode("mistakes");
    setActiveTab("test");
  }

  function mergeMistakes(nextMistakes) {
    setMistakes((currentMistakes) => {
      const byId = new Map(currentMistakes.map((question) => [question.id, question]));
      nextMistakes.forEach((question) => byId.set(question.id, question));
      return Array.from(byId.values());
    });
  }

  async function publishToCommunity() {
    if (!studySet.isOwner || publishedAt || isPublishing) return;
    setPublishMessage("");
    setIsPublishing(true);
    try {
      const result = await publishLearningStudySetAction({ studySetId: studySet.id });
      if (!result.ok) {
        setPublishMessage(result.error || "Nu am putut publica materialul.");
        return;
      }
      setPublishedAt(result.result?.publishedAt || new Date().toISOString());
      setPublishMessage("Material publicat pentru comunitatea ta.");
      setPublishConfirmationOpen(false);
    } finally {
      setIsPublishing(false);
    }
  }

  async function reportCommunityMaterial() {
    if (studySet.isOwner || isReporting) return;
    setReportMessage("");
    setIsReporting(true);
    try {
      const result = await reportLearningStudySetAction({
        studySetId: studySet.id,
        reason: "content_issue"
      });
      setReportMessage(result.ok ? "Raportarea a fost trimisa." : result.error || "Nu am putut trimite raportarea.");
    } finally {
      setIsReporting(false);
    }
  }

  async function retryStudySet() {
    if (!studySet.isOwner || studySet.status !== "failed" || isRetrying) return;
    setRetryMessage("");
    setIsRetrying(true);
    try {
      const result = await retryLearningStudySetAction({ studySetId: studySet.id });
      if (!result.ok) {
        setRetryMessage(result.error || "Nu am putut relua procesarea.");
        return;
      }
      setRetryMessage("Procesarea a fost reluata.");
      router.refresh();
    } finally {
      setIsRetrying(false);
    }
  }

  async function deleteStudySet() {
    if (!studySet.isOwner || isDeleting) return;
    setDeleteMessage("");
    setIsDeleting(true);
    try {
      const result = await deleteLearningStudySetAction({ studySetId: studySet.id });
      if (!result.ok) {
        setDeleteMessage(result.error || "Nu am putut sterge materialul.");
        return;
      }
      router.replace(`/materiale/invata?message=${encodeURIComponent("Materialul a fost sters.")}`);
      router.refresh();
    } finally {
      setIsDeleting(false);
    }
  }

  if (isProcessing) {
    return (
      <>
        <LearningProcessingPanel studySet={studySet} />
        {studySet.isOwner ? (
          <div className="learning-owner-delete-row">
            <LearningDeleteControl
              isOpen={deleteConfirmationOpen}
              isDeleting={isDeleting}
              message={deleteMessage}
              onOpen={() => setDeleteConfirmationOpen(true)}
              onCancel={() => {
                setDeleteConfirmationOpen(false);
                setDeleteMessage("");
              }}
              onConfirm={deleteStudySet}
            />
          </div>
        ) : null}
      </>
    );
  }

  return (
    <section className="learning-study-set">
      <div className="learning-study-hero">
        <div>
          <span className="ui-section-label">Material gata de învățat</span>
          <h1>{studySet.title}</h1>
          <p>
            {`${studySet.chapterCount} capitole, ${studySet.flashcardCount} flashcards și ${studySet.questionCount} întrebări pregătite.`}
          </p>
        </div>
        <div className="learning-study-next">
          <Target aria-hidden="true" />
          <span>Recomandat pentru început</span>
          <strong>{nextChapter ? `Incepe cu ${nextChapter.title}` : "Incepe cu flashcards"}</strong>
          <button
            type="button"
            data-usage-event="learning_continue_clicked"
            data-usage-label={nextChapter ? "Continua capitole" : "Continua flashcards"}
            onClick={() => setActiveTab(nextChapter ? "chapters" : "flashcards")}
          >
            {nextChapter ? "Deschide primul capitol" : "Începe cu flashcards"}
          </button>
          {studySet.isOwner ? (
            publishedAt ? (
              <span className="learning-community-badge">Publicat pentru comunitatea ta</span>
            ) : publishConfirmationOpen ? (
              <div className="learning-publish-confirmation" role="status">
                <strong>Distribui acest material colegilor?</strong>
                <span>Vor putea invata din el, iar progresul fiecaruia ramane separat. Fisierul sursa ramane privat.</span>
                <div>
                  <button type="button" className="secondary" disabled={isPublishing} onClick={() => setPublishConfirmationOpen(false)}>
                    Pastreaza privat
                  </button>
                  <button
                    type="button"
                    className="learning-publish-confirm"
                    data-usage-event="learning_set_published"
                    data-usage-label="Distribuie clasei"
                    disabled={isPublishing}
                    onClick={publishToCommunity}
                  >
                    {isPublishing ? "Se distribuie..." : "Distribuie clasei"}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="secondary learning-publish-button"
                data-usage-event="learning_set_publish_opened"
                data-usage-label="Distribuie clasei"
                onClick={() => setPublishConfirmationOpen(true)}
              >
                Distribuie clasei
              </button>
            )
          ) : (
            <>
              <span className="learning-community-badge">Material din comunitate</span>
              <button
                type="button"
                className="secondary learning-report-button"
                data-usage-event="learning_set_reported"
                data-usage-label="Raporteaza material"
                disabled={isReporting}
                onClick={reportCommunityMaterial}
              >
                {isReporting ? "Se trimite..." : "Raporteaza material"}
              </button>
            </>
          )}
          {publishMessage ? <p className="learning-save-message" role="status">{publishMessage}</p> : null}
          {reportMessage ? <p className="learning-save-message" role="status">{reportMessage}</p> : null}
          {studySet.isOwner ? (
            <LearningDeleteControl
              isOpen={deleteConfirmationOpen}
              isDeleting={isDeleting}
              message={deleteMessage}
              onOpen={() => setDeleteConfirmationOpen(true)}
              onCancel={() => {
                setDeleteConfirmationOpen(false);
                setDeleteMessage("");
              }}
              onConfirm={deleteStudySet}
            />
          ) : null}
        </div>
      </div>

      {studySet.isOwner && studySet.status === "failed" ? (
        <div className="learning-retry-panel">
          <div>
            <strong>Procesarea s-a oprit.</strong>
            <span>Reluam salvarea materialelor din sursa pastrata, fara o incarcare noua.</span>
          </div>
          <button
            type="button"
            className="secondary"
            data-usage-event="learning_retry_started"
            data-usage-label="Retry material invatare"
            disabled={isRetrying}
            onClick={retryStudySet}
          >
            {isRetrying ? "Se reia..." : "Reia procesarea"}
          </button>
          {retryMessage ? <p className="learning-save-message" role="status">{retryMessage}</p> : null}
        </div>
      ) : null}

      {studySet.warnings.length ? (
        <div className="learning-warning-panel">
          <strong>Atentionari</strong>
          {studySet.warnings.map((warning) => (
            <span key={warning}>{warning}</span>
          ))}
        </div>
      ) : null}

      <div className="learning-kpi-grid">
        <KpiCard label="Capitole" value={studySet.chapterCount} detail={`${studySet.estimatedPages} pagini estimate`} />
        <KpiCard label="Concepte" value={studySet.conceptCount} detail={studySet.recommendedLevel} />
        <KpiCard label="Flashcards" value={studySet.flashcardCount} detail="pentru repetare" />
        <KpiCard label="Întrebări" value={studySet.questionCount} detail="pentru verificare" />
      </div>

      <div
        className="learning-tabs"
        role="tablist"
        aria-label="Moduri invatare"
        onKeyDown={handleTablistKeyDown}
      >
        {PRIMARY_TABS.map((tab) => (
          <button
            key={tab.id}
            id={`learning-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls="learning-active-panel"
            tabIndex={activeTab === tab.id ? 0 : -1}
            className={activeTab === tab.id ? "is-active" : ""}
            data-usage-event="learning_tab_opened"
            data-usage-label={tab.label}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <details className="learning-more-modes" open={isMoreTabActive}>
        <summary>{isMoreTabActive ? `Mai multe moduri: ${activeTabLabel}` : "Mai multe moduri"}</summary>
        <div aria-label="Moduri suplimentare de invatare">
          {MORE_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              aria-pressed={activeTab === tab.id}
              className={activeTab === tab.id ? "is-active" : ""}
              data-usage-event="learning_tab_opened"
              data-usage-label={tab.label}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </details>

      <div
        id="learning-active-panel"
        role="tabpanel"
        aria-label={`Modul ${activeTabLabel}`}
      >
      {activeTab === "overview" ? (
        <section className="learning-start-panel" aria-labelledby="learning-start-title">
          <div className="learning-start-head">
            <span className="ui-section-label">Alege un mod</span>
            <h2 id="learning-start-title">Cum vrei să începi?</h2>
            <p>Poți schimba modul oricând. Progresul se salvează automat.</p>
          </div>
          <div className="learning-start-options">
            <button
              type="button"
              disabled={!studySet.flashcardCount}
              onClick={() => setActiveTab("flashcards")}
            >
              <span className="learning-start-icon" aria-hidden="true"><Brain /></span>
              <span>
                <strong>Repetă cu flashcards</strong>
                <small>{`${studySet.flashcardCount} carduri · ritm rapid`}</small>
              </span>
              <ArrowRight aria-hidden="true" />
            </button>
            <button
              type="button"
              disabled={!studySet.questionCount}
              onClick={() => setActiveTab("test")}
            >
              <span className="learning-start-icon" aria-hidden="true"><ListChecks /></span>
              <span>
                <strong>Verifică prin întrebări</strong>
                <small>{`${studySet.questionCount} întrebări · răspuns imediat`}</small>
              </span>
              <ArrowRight aria-hidden="true" />
            </button>
          </div>
          {nextChapter ? (
            <button type="button" className="learning-start-chapter" onClick={() => setActiveTab("chapters")}>
              <BookOpen aria-hidden="true" />
              <span><small>Preferi să citești?</small><strong>Deschide {nextChapter.title}</strong></span>
              <ArrowRight aria-hidden="true" />
            </button>
          ) : null}
          {studySet.attempts.length ? (
            <p className="learning-start-progress" role="status">
              {`Ultimul rezultat salvat: ${studySet.attempts[0].score}% · ${studySet.attempts.length} ${studySet.attempts.length === 1 ? "rundă" : "runde"}`}
            </p>
          ) : null}
        </section>
      ) : null}

      {activeTab === "chapters" ? (
        <div className="learning-chapter-grid">
          {studySet.chapters.map((chapter) => (
            <ChapterCard key={chapter.id} chapter={chapter} onStartChapterTest={startChapterTest} />
          ))}
        </div>
      ) : null}

      {activeTab === "flashcards" ? (
        <FlashcardsTab studySetId={studySet.id} flashcards={studySet.flashcards} />
      ) : null}

      {activeTab === "test" ? (
        <TestTab
          studySetId={studySet.id}
          questions={questionsWithChapterTitles}
          mistakeQuestions={mistakes}
          chapterId={chapterFilter}
          testMode={testMode}
          onChapterChange={setChapterFilter}
          onTestModeChange={setTestMode}
          onMistakes={mergeMistakes}
        />
      ) : null}

      {activeTab === "simulation" ? (
        <ExamSimulationTab chapters={studySet.chapters} questions={questionsWithChapterTitles} />
      ) : null}

      {activeTab === "competition" ? (
        <CompetitionTab leaderboard={studySet.leaderboard} />
      ) : null}

      {activeTab === "mistakes" ? (
        <section className="learning-mistakes-panel">
          {mistakes.length ? (
            <>
              <div className="learning-upload-section-head">
                <div>
                  <span className="ui-section-label">Greseli</span>
                  <h2>Repeta intrebarile ratate</h2>
                </div>
                <button
                  type="button"
                  className="secondary"
                  data-usage-event="learning_mistakes_started"
                  data-usage-label="Test doar din greseli"
                  onClick={startMistakesTest}
                >
                  Test doar din greseli
                </button>
              </div>
              {mistakes.map((question) => (
                <article key={question.id} className="learning-question-card">
                  <strong>{question.questionText}</strong>
                  <p>{question.explanation}</p>
                </article>
              ))}
            </>
          ) : (
            <div className="learning-empty-panel">
              Nu ai greseli in sesiunea curenta. Fa un test si revino aici.
            </div>
          )}
        </section>
      ) : null}

      {activeTab === "plan" ? (
        <section className="learning-plan-list">
          {studySet.plan.length ? (
            studySet.plan.map((day, index) => {
              const dayLabel = `Ziua ${day.day || index + 1}`;
              const title = day.title && day.title !== dayLabel ? day.title : dayLabel;

              return (
                <article key={`${day.title}-${index}`} className="learning-plan-card">
                  <span>Plan zilnic</span>
                  <strong>{title}</strong>
                  {day.activities.map((activity) => (
                    <p key={activity}>{activity}</p>
                  ))}
                </article>
              );
            })
          ) : (
            <div className="learning-empty-panel">Planul apare dupa ce exista capitole salvate.</div>
          )}
        </section>
      ) : null}
      </div>

      <div className="learning-study-footer">
        <Link className="btn-link secondary" href="/materiale/invata">
          Incarca alta materie
        </Link>
        <button type="button" className="secondary" onClick={() => setActiveTab("overview")}>
          <RotateCcw aria-hidden="true" size={16} />
          Inapoi la inceput
        </button>
      </div>
    </section>
  );
}
