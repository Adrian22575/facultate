"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BookOpen, CheckCircle2, Layers3, RotateCcw, Target, XCircle } from "lucide-react";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "chapters", label: "Capitole" },
  { id: "flashcards", label: "Flashcards" },
  { id: "test", label: "Test" },
  { id: "mistakes", label: "Greseli" },
  { id: "plan", label: "Plan" }
];

function answerLabel(index) {
  return String.fromCharCode(65 + index);
}

function normalizeQuestions(questions) {
  return questions.filter((question) => Array.isArray(question.answers) && question.answers.length >= 2);
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
      <div className="learning-chapter-actions">
        <button type="button" className="secondary" onClick={() => onStartChapterTest(chapter.id)}>
          Test capitol
        </button>
      </div>
    </article>
  );
}

function FlashcardsTab({ flashcards }) {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [ratings, setRatings] = useState({});
  const current = flashcards[index] || null;
  const weakCount = Object.values(ratings).filter((rating) => rating === "nu_stiu" || rating === "aproape").length;

  function rateCurrent(rating) {
    if (!current) return;
    setRatings((value) => ({ ...value, [current.id]: rating }));
    setRevealed(false);
    setIndex((value) => Math.min(value + 1, flashcards.length));
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
        <strong>{current.hint || "Flashcards"}</strong>
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
        <button type="button" className="secondary" onClick={() => rateCurrent("nu_stiu")}>
          Nu stiu
        </button>
        <button type="button" className="secondary" onClick={() => rateCurrent("aproape")}>
          Aproape
        </button>
        <button type="button" onClick={() => rateCurrent("stiu")}>
          Stiu
        </button>
        <button type="button" className="secondary" onClick={() => rateCurrent("mai_tarziu")}>
          Mai tarziu
        </button>
      </div>
    </section>
  );
}

function TestTab({ questions, chapterId = "all", onChapterChange, onMistakes }) {
  const availableQuestions = useMemo(() => {
    const safeQuestions = normalizeQuestions(questions);
    return chapterId === "all"
      ? safeQuestions.slice(0, 10)
      : safeQuestions.filter((question) => question.chapterId === chapterId).slice(0, 10);
  }, [chapterId, questions]);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const unansweredCount = availableQuestions.filter((question) => answers[question.id] === undefined).length;

  function finishTest() {
    if (unansweredCount) {
      setResult({ type: "warning", message: `Mai ai ${unansweredCount} intrebari fara raspuns.` });
      return;
    }

    const wrong = availableQuestions.filter((question) => answers[question.id] !== question.correctIndex);
    const score = availableQuestions.length - wrong.length;
    const percentage = availableQuestions.length ? Math.round((score / availableQuestions.length) * 100) : 0;
    onMistakes(wrong);
    setResult({ type: "done", score, total: availableQuestions.length, percentage, wrong });
  }

  if (!availableQuestions.length) {
    return <div className="learning-empty-panel">Nu avem intrebari pentru selectia curenta.</div>;
  }

  return (
    <section className="learning-test-shell">
      <div className="learning-test-toolbar">
        <label>
          Capitol
          <select value={chapterId} onChange={(event) => onChapterChange(event.target.value)}>
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
        <span>{`${availableQuestions.length} intrebari`}</span>
      </div>

      <div className="learning-question-list">
        {availableQuestions.map((question, questionIndex) => (
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
        <div className={`learning-test-result ${result.type === "warning" ? "is-warning" : "is-done"}`}>
          {result.type === "warning" ? <XCircle aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}
          <div>
            <strong>
              {result.type === "warning"
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
      ) : null}

      <div className="learning-test-actions">
        <button type="button" onClick={finishTest}>
          Vezi rezultatul
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => {
            setAnswers({});
            setResult(null);
          }}
        >
          Reseteaza
        </button>
      </div>
    </section>
  );
}

export function LearningStudySetClient({ studySet }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [chapterFilter, setChapterFilter] = useState("all");
  const [mistakes, setMistakes] = useState([]);
  const questionsWithChapterTitles = useMemo(() => {
    const chapterTitleById = new Map(studySet.chapters.map((chapter) => [chapter.id, chapter.title]));
    return studySet.questions.map((question) => ({
      ...question,
      chapterTitle: chapterTitleById.get(question.chapterId) || "Capitol"
    }));
  }, [studySet.chapters, studySet.questions]);
  const nextChapter = studySet.chapters[0] || null;

  function startChapterTest(chapterId) {
    setChapterFilter(chapterId);
    setActiveTab("test");
  }

  return (
    <section className="learning-study-set">
      <div className="learning-study-hero">
        <div>
          <span className="ui-section-label">Materia este gata</span>
          <h1>{studySet.title}</h1>
          <p>
            Ai capitole, flashcards, intrebari si un plan simplu. Incepe cu recomandarea sau mergi
            direct la modulul dorit.
          </p>
        </div>
        <div className="learning-study-next">
          <Target aria-hidden="true" />
          <strong>{nextChapter ? `Incepe cu ${nextChapter.title}` : "Incepe cu flashcards"}</strong>
          <button type="button" onClick={() => setActiveTab(nextChapter ? "chapters" : "flashcards")}>
            Continua invatarea
          </button>
        </div>
      </div>

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
        <KpiCard label="Intrebari" value={studySet.questionCount} detail="test rapid" />
        <KpiCard label="Plan" value={`${studySet.recommendedDays} zile`} detail={`${studySet.recommendedMinutesPerDay} min/zi`} />
      </div>

      <div className="learning-tabs" role="tablist" aria-label="Moduri invatare">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            aria-selected={activeTab === tab.id}
            className={activeTab === tab.id ? "is-active" : ""}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" ? (
        <div className="learning-overview-grid">
          <article className="surface learning-overview-card">
            <BookOpen aria-hidden="true" />
            <div>
              <h2>Recomandarea de azi</h2>
              <p>
                Parcurge primul capitol, apoi fa flashcards si un test scurt. Daca gresesti,
                greselile apar in tabul dedicat.
              </p>
            </div>
          </article>
          <article className="surface learning-overview-card">
            <Layers3 aria-hidden="true" />
            <div>
              <h2>Material privat</h2>
              <p>
                Setul ramane in contul tau. Publicarea pentru comunitate va fi o actiune separata,
                dupa verificare.
              </p>
            </div>
          </article>
        </div>
      ) : null}

      {activeTab === "chapters" ? (
        <div className="learning-chapter-grid">
          {studySet.chapters.map((chapter) => (
            <ChapterCard key={chapter.id} chapter={chapter} onStartChapterTest={startChapterTest} />
          ))}
        </div>
      ) : null}

      {activeTab === "flashcards" ? <FlashcardsTab flashcards={studySet.flashcards} /> : null}

      {activeTab === "test" ? (
        <TestTab
          questions={questionsWithChapterTitles}
          chapterId={chapterFilter}
          onChapterChange={setChapterFilter}
          onMistakes={setMistakes}
        />
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
                <button type="button" className="secondary" onClick={() => setActiveTab("test")}>
                  Test nou
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
            studySet.plan.map((day, index) => (
              <article key={`${day.title}-${index}`} className="learning-plan-card">
                <span>{day.title}</span>
                <strong>{`Ziua ${day.day}`}</strong>
                {day.activities.map((activity) => (
                  <p key={activity}>{activity}</p>
                ))}
              </article>
            ))
          ) : (
            <div className="learning-empty-panel">Planul apare dupa ce exista capitole salvate.</div>
          )}
        </section>
      ) : null}

      <div className="learning-study-footer">
        <Link className="btn-link secondary" href="/materiale/invata">
          Incarca alta materie
        </Link>
        <button type="button" className="secondary" onClick={() => setActiveTab("overview")}>
          <RotateCcw aria-hidden="true" size={16} />
          Inapoi la overview
        </button>
      </div>
    </section>
  );
}
