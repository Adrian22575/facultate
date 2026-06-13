"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  CheckCircle2,
  RotateCcw,
  SlidersHorizontal,
  Trophy,
  XCircle,
  Zap
} from "lucide-react";

import { shuffleArray } from "@/lib/quiz";

const MISTAKES_STORAGE_KEY = "licenta_mistakes";
const QUICK_QUESTION_COUNT = 5;
const VERIFY_QUESTION_COUNT = 10;
const CUSTOM_OPTIONS = [10, 20, 30, 40, 50, 60, 100];

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

function hashText(value) {
  let hash = 0;
  const text = String(value || "");

  for (let index = 0; index < text.length; index += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash).toString(36);
}

function buildQuestionKey(question, index) {
  const subjectId = question.subjectId || "licenta";

  if (question.id !== undefined && question.id !== null && question.id !== "") {
    return `${subjectId}:${question.id}`;
  }

  return `${subjectId}:text-${hashText(question.text || index)}`;
}

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

function scrollToTop() {
  if (typeof window !== "undefined") {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

export function ExamPageClient({ questions, subjectCount }) {
  const preparedQuestions = useMemo(
    () =>
      questions.map((question, index) => ({
        ...question,
        stableId: buildQuestionKey(question, index)
      })),
    [questions]
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

  useEffect(() => {
    const validIds = readStoredMistakeIds().filter((id) => questionById.has(id));
    setMistakeIds(validIds);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(MISTAKES_STORAGE_KEY, JSON.stringify(validIds));
    }
  }, [questionById]);

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
    setPhase("modes");
    setActiveMode(null);
    setCurrentQuestions([]);
    setAnswers([]);
    setResultSummary(null);
    setNotice(message);
    scrollToTop();
  }

  function startQuiz(numberOfQuestions, mode) {
    setNotice("");
    setResultSummary(null);
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
    setPhase("quiz");
    scrollToTop();
  }

  function startVerifyRound() {
    setNotice("");
    setResultSummary(null);
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
    setPhase("quiz");
    scrollToTop();
  }

  function startBrowseQuestions() {
    setNotice("");
    setResultSummary(null);
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
  }

  function finishQuiz() {
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

    setResultSummary({
      mode: activeMode,
      score,
      total: currentQuestions.length,
      percentage,
      wrongQuestions,
      completedQuestions: currentQuestions,
      completedAnswers: answers
    });
    setPhase("result");
    scrollToTop();
  }

  function retryCurrentMode() {
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

  function markBrowseKnown() {
    const question = currentQuestions[browseIndex];
    removeMistake(question);
  }

  function markBrowseUnknown() {
    const question = currentQuestions[browseIndex];
    addMistake(question);
  }

  function goToNextBrowseQuestion() {
    if (browseIndex >= currentQuestions.length - 1) {
      goToModes("Ai parcurs toate intrebarile disponibile.");
      return;
    }

    setBrowseIndex((index) => index + 1);
    setShowBrowseAnswer(false);
    scrollToTop();
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
                <div className="question-title">{`${index + 1}. ${question.text}`}</div>
                <div className="meta">{question.subjectTitle ? `Materia: ${question.subjectTitle}` : "Licenta"}</div>
                {isVerificationMode ? (
                  <>
                    <div className="licenta-prep-proposed-answer">
                      <span>Raspuns propus</span>
                      <strong>
                        {`${answerLabel(question.proposedIndex)}. ${question.answers[question.proposedIndex]}`}
                      </strong>
                    </div>
                    <div className="licenta-prep-truth-actions" aria-label="Alege daca raspunsul propus este corect">
                      <button
                        type="button"
                        className={answers[index] === true ? "is-selected" : ""}
                        onClick={() => answerVerificationQuestion(index, true)}
                      >
                        Corect
                      </button>
                      <button
                        type="button"
                        className={answers[index] === false ? "is-selected" : ""}
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
                        <span>{`${answerLabel(answerIndex)}. ${answer}`}</span>
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
            </div>
            <div className="licenta-prep-actions">
              <button type="button" className="secondary" onClick={() => goToModes()}>
                Inapoi la moduri
              </button>
              <button type="button" onClick={finishQuiz}>
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
            <div className="question-title">{browseQuestion.text}</div>
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
                  <span>{`${answerLabel(answerIndex)}. ${answer}`}</span>
                </div>
              ))}
            </div>
          </article>

          <div className="licenta-prep-actions">
            {!showBrowseAnswer ? (
              <button type="button" onClick={() => setShowBrowseAnswer(true)}>
                Arata raspunsul
              </button>
            ) : (
              <>
                <button type="button" className="secondary" onClick={markBrowseKnown}>
                  Stiu asta
                </button>
                <button type="button" className="secondary" onClick={markBrowseUnknown}>
                  Nu stiu asta
                </button>
                <button type="button" onClick={goToNextBrowseQuestion}>
                  Urmatoarea
                </button>
              </>
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

          <hr className="result-divider" />
          <h3>{isResultVerificationMode ? "Verificari gresite" : "Intrebari gresite"}</h3>

          {resultSummary.wrongQuestions.length ? (
            <div className="licenta-prep-wrong-list">
              {resultSummary.wrongQuestions.map(({ question, selectedIndex, selectedTruth, proposedIndex }, index) => (
                <article key={`${question.stableId}-wrong-${index}`} className="result-detail">
                  <strong>{`${index + 1}. ${question.text}`}</strong>
                  <div className="result-meta">
                    {question.subjectTitle ? `Materia: ${question.subjectTitle}` : "Licenta"}
                  </div>
                  {isResultVerificationMode ? (
                    <>
                      <div>
                        Raspuns propus:{" "}
                        <strong>
                          {proposedIndex !== null && proposedIndex !== undefined
                            ? `${answerLabel(proposedIndex)}. ${question.answers[proposedIndex]}`
                            : "Fara raspuns propus"}
                        </strong>
                      </div>
                      <div>
                        Ai spus:{" "}
                        {selectedTruth === true ? "Corect" : selectedTruth === false ? "Gresit" : "Fara raspuns"}
                      </div>
                      <div>
                        Raspunsul propus era:{" "}
                        <strong>{proposedIndex === question.correctIndex ? "Corect" : "Gresit"}</strong>
                      </div>
                      <div>
                        Raspuns corect: <strong>{question.answers[question.correctIndex]}</strong>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        Raspunsul tau:{" "}
                        {selectedIndex !== null && selectedIndex !== undefined
                          ? question.answers[selectedIndex]
                          : "Fara raspuns"}
                      </div>
                      <div>
                        Raspuns corect: <strong>{question.answers[question.correctIndex]}</strong>
                      </div>
                    </>
                  )}
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
            <button type="button" onClick={retryCurrentMode}>
              Incearca din nou
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
