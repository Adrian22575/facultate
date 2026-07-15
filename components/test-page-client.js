"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { syncSubjectProgress } from "@/lib/progress-client";
import { saveLastSession } from "@/lib/session-storage";
import { shuffleArray } from "@/lib/quiz";
import { GamificationResultPanel } from "@/components/gamification-result-panel";
import { QuestionCorrectionButton } from "@/components/question-correction-button";
import { TestResultPanel } from "@/components/test-result-panel";

function sanitizeQuestions(questions) {
  if (!Array.isArray(questions)) {
    return [];
  }

  return questions.map((question, index) => ({
    ...question,
    id: question?.id ?? index + 1,
    text: typeof question?.text === "string" ? question.text : String(question?.text || ""),
    answers: Array.isArray(question?.answers)
      ? question.answers.map((answer) =>
          typeof answer === "string" ? answer : String(answer ?? "")
        )
      : [],
    correctIndex: Number.isInteger(question?.correctIndex) ? question.correctIndex : 0,
    explanation:
      typeof question?.explanation === "string" ? question.explanation.trim() : ""
  }));
}

function buildAnswerBank(questions) {
  const bank = new Set();
  questions.forEach((question) => {
    (question.answers || []).forEach((answer) => bank.add(answer));
  });
  return Array.from(bank).filter(Boolean);
}

function mixAnswersForHardMode(questions, answerBank) {
  return questions.map((question) => {
    const correctText = question.answers[question.correctIndex];
    const optionCount = Math.max(2, question.answers.length);

    if (!correctText) {
      return question;
    }

    const options = [correctText];
    const candidates = answerBank.filter((answer) => answer !== correctText);

    while (options.length < optionCount && candidates.length) {
      const picked = candidates[Math.floor(Math.random() * candidates.length)];
      if (!options.includes(picked)) {
        options.push(picked);
      }
    }

    if (options.length < optionCount) {
      return question;
    }

    const shuffledOptions = shuffleArray(options);
    return {
      ...question,
      answers: shuffledOptions,
      correctIndex: shuffledOptions.indexOf(correctText)
    };
  });
}

function createAttemptKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `subject-test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function normalizeQuestionIds(questionIds) {
  return Array.from(
    new Set(
      (Array.isArray(questionIds) ? questionIds : [])
        .map((questionId) => String(questionId || "").trim())
        .filter(Boolean)
    )
  );
}

function getSimpleTestAdvice(stats) {
  const community = stats?.community || null;
  const comparison = getSubjectTestComparison(stats);

  if (stats?.currentScore >= 80) {
    return "Scor bun. Pastreaza ritmul si repeta doar greselile.";
  }

  if (comparison?.tone === "negative") {
    return "Esti sub media colegilor. Repeta greselile si refa testul.";
  }

  if (stats?.currentScore >= 50) {
    return "Esti aproape. Mai fa o runda scurta din greseli.";
  }

  return "Incepe cu greselile si refa testul pe acelasi set.";
}

function getSubjectTestComparison(stats) {
  const community = stats?.community || null;
  const communityAverage = Number(community?.averageScore);
  const currentScore = Number(stats?.currentScore);

  if (!Number.isFinite(currentScore) || !Number.isFinite(communityAverage) || communityAverage <= 0) {
    return null;
  }

  const delta = Math.round(currentScore - communityAverage);
  const absDelta = Math.abs(delta);
  const scopeLabel = community?.scopeLabel || "comunitatea ta";
  const participantCount = Number(community?.participantCount || 0);
  const peerLabel =
    participantCount > 1
      ? `${participantCount} colegi cu progres salvat`
      : "datele comunitatii tale";

  if (delta > 0) {
    return {
      delta,
      tone: "positive",
      title: "Esti peste media comunitatii",
      detail: `Ai +${absDelta} puncte peste media din ${scopeLabel}.`,
      peerLabel
    };
  }

  if (delta < 0) {
    return {
      delta,
      tone: "negative",
      title: "Esti sub media comunitatii",
      detail: `Mai ai ${absDelta} puncte pana la media din ${scopeLabel}.`,
      peerLabel
    };
  }

  return {
    delta,
    tone: "neutral",
    title: "Esti la media comunitatii",
    detail: `Esti exact la media din ${scopeLabel}.`,
    peerLabel
  };
}

function getPersonalBestText(stats) {
  const personalBest = Number(stats?.personalBest || 0);
  const delta = Number(stats?.deltaFromPreviousBest);

  if (Number.isFinite(delta) && delta > 0) {
    return `Record nou: +${delta} puncte.`;
  }

  if (personalBest > 0) {
    return `Record personal: ${personalBest}%.`;
  }

  return "Primul rezultat salvat pentru materia asta.";
}

function SubjectTestInsight({ stats, status, onRetry }) {
  const community = stats?.community || null;
  const comparison = getSubjectTestComparison(stats);
  const toneClass = comparison ? ` is-${comparison.tone}` : " is-neutral";

  if (status === "saving") {
    return (
      <section className="simple-test-insight is-loading" aria-live="polite">
        <strong>Salvam rezultatul...</strong>
        <p>Statistica apare imediat dupa salvare.</p>
      </section>
    );
  }

  if (status === "error") {
    return (
      <section className="simple-test-insight is-muted" aria-live="polite">
        <strong>Scorul nu s-a salvat inca.</strong>
        <p>Rezultatul ramane pe ecran.</p>
        <button className="btn-link secondary subject-test-insight-link" type="button" onClick={onRetry}>
          Reincearca salvarea
        </button>
      </section>
    );
  }

  if (!stats) {
    return (
      <section className="simple-test-insight is-muted">
        <strong>Statistica apare dupa salvare.</strong>
        <p>Poti continua testele intre timp.</p>
        <Link className="btn-link secondary subject-test-insight-link" href="/statistici">
          Vezi statistici
        </Link>
      </section>
    );
  }

  return (
    <section className={`simple-test-insight${toneClass}`} aria-label="Statistici test">
      <div className="simple-test-insight-head">
        <span className="simple-test-insight-kicker">Comparatie comunitate</span>
        <h3>{comparison?.title || "Rezultatul tau este salvat"}</h3>
        <p>{comparison?.detail || "Mai avem nevoie de cateva rezultate in comunitatea ta ca sa aratam comparatia."}</p>
      </div>

      <div className="simple-test-comparison-row">
        <div className="simple-test-score-card is-user">
          <span>Tu</span>
          <strong>{`${stats.currentScore}%`}</strong>
        </div>
        <div className="simple-test-score-card is-community">
          <span>Comunitatea</span>
          <strong>{community ? `${community.averageScore}%` : "In curs"}</strong>
        </div>
        <div className="simple-test-delta-card">
          <span>Diferenta</span>
          <strong>
            {comparison
              ? comparison.delta > 0
                ? `+${comparison.delta}`
                : `${comparison.delta}`
              : "-"}
          </strong>
          <small>puncte</small>
        </div>
      </div>

      <p className="simple-test-next-step">
        <strong>Urmatorul pas:</strong> {getSimpleTestAdvice(stats)}
      </p>
      <p className="simple-test-context">
        {`${getPersonalBestText(stats)}${
          comparison?.peerLabel ? ` Comparatia foloseste ${comparison.peerLabel}.` : ""
        }`}
      </p>

      <div className="simple-test-insight-actions">
        <Link className="btn-link secondary subject-test-insight-link" href="/statistici">
          Mai multe statistici
        </Link>
      </div>
    </section>
  );
}

export function TestPageClient({
  subject,
  initialQuestions,
  initialMistakeQuestionIds = [],
  initialMode = ""
}) {
  const [safeInitialQuestions, setSafeInitialQuestions] = useState(() => sanitizeQuestions(initialQuestions));
  const [count, setCount] = useState("10");
  const [mode, setMode] = useState("1");
  const [phase, setPhase] = useState("setup");
  const [testQuestions, setTestQuestions] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [reviewRound, setReviewRound] = useState(false);
  const [answerNotice, setAnswerNotice] = useState("");
  const [resultStats, setResultStats] = useState(null);
  const [resultStatsStatus, setResultStatsStatus] = useState("idle");
  const [gamificationResult, setGamificationResult] = useState(null);
  const [syncRevision, setSyncRevision] = useState(0);
  const [mistakeQuestionIds, setMistakeQuestionIds] = useState(() =>
    normalizeQuestionIds(initialMistakeQuestionIds)
  );
  const [setupNotice, setSetupNotice] = useState("");
  const lastSyncedScoreRef = useRef("");
  const attemptKeyRef = useRef("");
  const openedInitialMistakesRef = useRef(false);

  useEffect(() => {
    setSafeInitialQuestions(sanitizeQuestions(initialQuestions));
  }, [initialQuestions]);

  useEffect(() => {
    setMistakeQuestionIds(normalizeQuestionIds(initialMistakeQuestionIds));
  }, [initialMistakeQuestionIds]);

  useEffect(() => {
    saveLastSession({
      subjectId: subject.id,
      subjectTitle: subject.title,
      mode: "Test",
      url: `/materii/${subject.id}/test`
    });
  }, [subject.id, subject.title]);

  function startQuestionSet(questionSet, isReview = false) {
    setTestQuestions(
      questionSet.map((question) => ({
        ...question,
        answers: Array.isArray(question.answers) ? [...question.answers] : []
      }))
    );
    setAnswers(new Array(questionSet.length).fill(null));
    setCurrentIndex(0);
    setReviewRound(isReview);
    setAnswerNotice("");
    setSetupNotice("");
    setResultStats(null);
    setResultStatsStatus("idle");
    setGamificationResult(null);
    setSyncRevision(0);
    lastSyncedScoreRef.current = "";
    attemptKeyRef.current = createAttemptKey();
    setPhase("quiz");

    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function startTest() {
    let pool = safeInitialQuestions.map((question) => ({
      ...question,
      answers: [...question.answers]
    }));

    if (mode === "2" || mode === "3") {
      pool = shuffleArray(pool);
    }

    const take = count === "all" ? pool.length : Math.min(Number(count), pool.length);
    let selectedQuestions = pool.slice(0, take);

    if (mode === "3") {
      selectedQuestions = mixAnswersForHardMode(
        selectedQuestions,
        buildAnswerBank(safeInitialQuestions)
      );
    }

    startQuestionSet(selectedQuestions, false);
  }

  function startMistakesTest() {
    const mistakeIds = new Set(mistakeQuestionIds);
    const selectedQuestions = safeInitialQuestions.filter((question) => mistakeIds.has(String(question.id)));

    if (!selectedQuestions.length) {
      setSetupNotice("Nu mai ai greseli salvate pentru intrebarile disponibile acum.");
      return;
    }

    startQuestionSet(selectedQuestions, false);
  }

  function repeatCurrentTest() {
    if (!testQuestions.length) {
      setPhase("setup");
      return;
    }

    startQuestionSet(testQuestions, reviewRound);
  }

  function startAnotherTest() {
    setReviewRound(false);
    startTest();
  }

  const currentQuestion = testQuestions[currentIndex] || null;
  const answeredCount = answers.filter((answer) => answer !== null).length;

  function chooseAnswer(answerIndex) {
    const nextAnswers = [...answers];
    nextAnswers[currentIndex] = answerIndex;
    setAnswers(nextAnswers);
    setAnswerNotice("");
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
    setSafeInitialQuestions((current) => current.map((question) => mergeCorrectedQuestion(question, correction)));
    setTestQuestions((current) => current.map((question) => mergeCorrectedQuestion(question, correction)));
  }

  useEffect(() => {
    if (initialMode !== "mistakes" || openedInitialMistakesRef.current || !safeInitialQuestions.length) {
      return;
    }

    openedInitialMistakesRef.current = true;
    startMistakesTest();
  }, [initialMode, safeInitialQuestions, mistakeQuestionIds]);

  useEffect(() => {
    if (phase !== "result" || !testQuestions.length || reviewRound) {
      return undefined;
    }

    const correctAnswers = testQuestions.reduce((total, question, index) => {
      return total + (answers[index] === question.correctIndex ? 1 : 0);
    }, 0);
    const scorePercent = Math.round((correctAnswers / testQuestions.length) * 100);
    const syncKey = `${subject.id}:${reviewRound ? "review" : "main"}:${scorePercent}:${testQuestions.length}`;

    if (syncKey === lastSyncedScoreRef.current) {
      return undefined;
    }

    const timeoutId = window.setTimeout(async () => {
      setResultStatsStatus("saving");
      const payload = await syncSubjectProgress({
        subjectId: subject.id,
        mode: "test",
        testScorePercent: scorePercent,
        testQuestionCount: testQuestions.length,
        testCorrectCount: correctAnswers,
        testQuestionIds: testQuestions.map((question) => String(question.id)),
        wrongQuestionIds: testQuestions
          .filter((question, index) => answers[index] !== question.correctIndex)
          .map((question) => String(question.id)),
        idempotencyKey: attemptKeyRef.current
      });

      if (Array.isArray(payload?.mistakeQuestionIds)) {
        setMistakeQuestionIds(normalizeQuestionIds(payload.mistakeQuestionIds));
      }

      if (payload?.subjectTestStats) {
        lastSyncedScoreRef.current = syncKey;
        setResultStats(payload.subjectTestStats);
        setGamificationResult(payload.gamification || null);
        setResultStatsStatus("ready");
      } else {
        setResultStats(null);
        setResultStatsStatus("error");
      }
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [answers, phase, reviewRound, subject.id, syncRevision, testQuestions]);

  if (phase === "setup") {
    return (
      <section className="surface">
        <div className="selector-grid">
          <div className="selector-container">
            <label>
              Numar de intrebari
              <select value={count} onChange={(event) => setCount(event.target.value)}>
                <option value="5">5 intrebari</option>
                <option value="10">10 intrebari</option>
                <option value="20">20 intrebari</option>
                <option value="all">Toate</option>
              </select>
            </label>
          </div>

          <div className="selector-container">
            <label>
              Mod de lucru
              <select value={mode} onChange={(event) => setMode(event.target.value)}>
                <option value="1">In ordine</option>
                <option value="2">Intrebari amestecate</option>
                <option value="3">Intrebari si raspunsuri mixate</option>
              </select>
            </label>
          </div>
        </div>

        {mistakeQuestionIds.length ? (
          <div className="test-mistakes-setup">
            <div>
              <span>Greșelile mele</span>
              <strong>{`${mistakeQuestionIds.length} intrebari de reluat`}</strong>
              <p>Le poti reface separat; cele rezolvate corect ies automat din lista.</p>
            </div>
            <button className="secondary" type="button" onClick={startMistakesTest}>
              Repeta greselile
            </button>
          </div>
        ) : null}

        {setupNotice ? <p className="quiz-answer-required" role="status">{setupNotice}</p> : null}

        <div className="center test-setup-actions">
          <button type="button" onClick={startTest}>
            Incepe testul
          </button>
        </div>
      </section>
    );
  }

  if (phase === "result") {
    let correctAnswers = 0;
    const wrongQuestions = [];

    const wrongRows = [];

    testQuestions.forEach((question, index) => {
      const userAnswer = answers[index];
      const isCorrect = userAnswer === question.correctIndex;

      if (isCorrect) {
        correctAnswers += 1;
      } else {
        wrongQuestions.push({ ...question, answers: [...question.answers] });
        wrongRows.push({
          id: `${question.id}-${index}`,
          questionText: question.text,
          selectedIndex: userAnswer,
          selectedText: userAnswer === null ? "Fara raspuns" : question.answers[userAnswer],
          correctIndex: question.correctIndex,
          correctText: question.answers[question.correctIndex] || "Raspuns indisponibil",
          explanation: question.explanation
        });
      }
    });

    const scorePercent = testQuestions.length
      ? Math.round((correctAnswers / testQuestions.length) * 100)
      : 0;

    return (
      <TestResultPanel
        title={reviewRound ? "Rezultat revizuire" : "Rezultat final"}
        score={correctAnswers}
        total={testQuestions.length}
        percentage={scorePercent}
        wrongRows={wrongRows}
        stats={[{ label: "Greseli", value: wrongQuestions.length }]}
        insights={
          reviewRound ? null : (
            <>
              <SubjectTestInsight
                stats={resultStats}
                status={resultStatsStatus}
                onRetry={() => setSyncRevision((value) => value + 1)}
              />
              <GamificationResultPanel result={gamificationResult} />
            </>
          )
        }
        emptyMessage="Nu ai gresit nicio intrebare in aceasta runda."
        actions={
          <>
          {wrongQuestions.length ? (
            <button
              type="button"
              className="secondary"
              onClick={() => startQuestionSet(wrongQuestions, true)}
            >
              {`Revizuieste greselile (${wrongQuestions.length})`}
            </button>
          ) : null}
          {mistakeQuestionIds.length ? (
            <button type="button" className="secondary" onClick={startMistakesTest}>
              {`Repeta greselile salvate (${mistakeQuestionIds.length})`}
            </button>
          ) : null}
          <button
            className="restart-btn"
            type="button"
            onClick={repeatCurrentTest}
          >
            Repeta testul
          </button>
          <button
            className="secondary"
            type="button"
            onClick={startAnotherTest}
          >
            Mai fa un test
          </button>
          </>
        }
      />
    );
  }

  if (!currentQuestion) {
    return <div className="error-state" role="alert">Nu am putut incarca intrebarile pentru acest test.</div>;
  }

  const progressPercent = testQuestions.length
    ? ((currentIndex + 1) / testQuestions.length) * 100
    : 0;
  const hasAnsweredCurrentQuestion = answers[currentIndex] !== null;

  function advanceCurrentQuestion() {
    if (!hasAnsweredCurrentQuestion) {
      setAnswerNotice("Alege un raspuns inainte sa mergi mai departe.");
      return;
    }

    setAnswerNotice("");

    if (currentIndex < testQuestions.length - 1) {
      setCurrentIndex((value) => value + 1);
    } else {
      setResultStats(null);
      setResultStatsStatus("saving");
      setPhase("result");
    }
  }

  return (
    <section className="surface">
      <div className="progress-bar-container" aria-label="Progres test">
        <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
      </div>

      <div className="quiz-meta">
        <div>{`${currentIndex + 1} / ${testQuestions.length}`}</div>
        <div>{`Raspunse: ${answeredCount}/${testQuestions.length}`}</div>
      </div>

      <div className="question">
        <div className="question-inline-head">
          <strong>
            <span>{`${currentIndex + 1}. `}</span>
            <span className="question-rich-text">{currentQuestion.text}</span>
          </strong>
          <QuestionCorrectionButton question={currentQuestion} onSaved={applySavedCorrection} />
        </div>
        <div className="answers">
          {currentQuestion.answers.map((answer, answerIndex) => (
            <label key={`${currentQuestion.id}-${answerIndex}`}>
              <input
                checked={answers[currentIndex] === answerIndex}
                name={`q-${currentIndex}`}
                type="radio"
                value={answerIndex}
                onChange={() => chooseAnswer(answerIndex)}
              />
              <span className="question-rich-text">{answer}</span>
            </label>
          ))}
        </div>
        {answerNotice ? <p className="quiz-answer-required" role="alert">{answerNotice}</p> : null}
      </div>

      <div className="quiz-actions">
        <button
          type="button"
          disabled={currentIndex === 0}
          onClick={() => setCurrentIndex((value) => value - 1)}
        >
          Anterioara
        </button>
        <button
          type="button"
          className={!hasAnsweredCurrentQuestion ? "is-disabled-soft" : ""}
          onClick={advanceCurrentQuestion}
        >
          {currentIndex === testQuestions.length - 1 ? "Finalizeaza" : "Urmatoarea"}
        </button>
      </div>
    </section>
  );
}
