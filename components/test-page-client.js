"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { syncSubjectProgress } from "@/lib/progress-client";
import { saveLastSession } from "@/lib/session-storage";
import { shuffleArray } from "@/lib/quiz";
import { TestResultPanel } from "@/components/test-result-panel";

function sanitizeQuestions(questions) {
  if (!Array.isArray(questions)) {
    return [];
  }

  return questions.map((question, index) => ({
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

export function TestPageClient({ subject, initialQuestions }) {
  const [count, setCount] = useState("10");
  const [mode, setMode] = useState("1");
  const [phase, setPhase] = useState("setup");
  const [testQuestions, setTestQuestions] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [reviewRound, setReviewRound] = useState(false);
  const lastSyncedScoreRef = useRef("");

  const safeInitialQuestions = useMemo(() => sanitizeQuestions(initialQuestions), [initialQuestions]);

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

  const currentQuestion = testQuestions[currentIndex] || null;
  const answeredCount = answers.filter((answer) => answer !== null).length;

  function chooseAnswer(answerIndex) {
    const nextAnswers = [...answers];
    nextAnswers[currentIndex] = answerIndex;
    setAnswers(nextAnswers);
  }

  useEffect(() => {
    if (phase !== "result" || !testQuestions.length) {
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

    const timeoutId = window.setTimeout(() => {
      lastSyncedScoreRef.current = syncKey;
      void syncSubjectProgress({
        subjectId: subject.id,
        mode: "test",
        testScorePercent: scorePercent
      });
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [answers, phase, reviewRound, subject.id, testQuestions]);

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
          <button
            className="restart-btn"
            type="button"
            onClick={() => {
              setPhase("setup");
              setCurrentIndex(0);
              setReviewRound(false);
            }}
          >
            Reincepe
          </button>
          </>
        }
      />
    );
  }

  if (!currentQuestion) {
    return <div className="error-state">Nu am putut incarca intrebarile pentru acest test.</div>;
  }

  const progressPercent = testQuestions.length
    ? ((currentIndex + 1) / testQuestions.length) * 100
    : 0;

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
        <strong>{`${currentIndex + 1}. ${currentQuestion.text}`}</strong>
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
              {answer}
            </label>
          ))}
        </div>
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
          onClick={() => {
            if (currentIndex < testQuestions.length - 1) {
              setCurrentIndex((value) => value + 1);
            } else {
              setPhase("result");
            }
          }}
        >
          {currentIndex === testQuestions.length - 1 ? "Finalizeaza" : "Urmatoarea"}
        </button>
      </div>
    </section>
  );
}
