"use client";

import Link from "next/link";
import { useState } from "react";
import {
  BarChart3,
  BookOpenCheck,
  Brain,
  Gauge,
  GraduationCap,
  Target
} from "lucide-react";

import { handleTablistKeyDown } from "@/lib/ui/tablist";

const TAB_ITEMS = [
  { key: "overview", label: "Rezumat" },
  { key: "materii", label: "Materii" },
  { key: "licenta", label: "Licență" },
  { key: "invatare", label: "Materiale" }
];

function valueOrPending(value, suffix = "") {
  return value === null || value === undefined ? "—" : `${value}${suffix}`;
}

function StatCard({ label, value, detail, icon: Icon }) {
  return (
    <article className="licenta-stats-card">
      <span className="licenta-stats-card-icon" aria-hidden="true">
        <Icon />
      </span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        {detail ? <p>{detail}</p> : null}
      </div>
    </article>
  );
}

function BarRows({ rows, emptyLabel = "Nu există încă date." }) {
  if (!rows.length) {
    return <p className="licenta-stats-empty-line">{emptyLabel}</p>;
  }

  return (
    <div className="licenta-stats-bars">
      {rows.map((row) => (
        <div key={row.key} className="licenta-stats-bar-row">
          <span>{row.label}</span>
          <div className="licenta-stats-bar-track">
            <div style={{ width: `${Math.max(row.percent, row.count ? 8 : 0)}%` }} />
          </div>
          <strong>{row.count}</strong>
        </div>
      ))}
    </div>
  );
}

function TrendChart({ rows, emptyLabel }) {
  if (!rows.length) {
    return (
      <div className="licenta-stats-chart-empty">
        <BarChart3 aria-hidden="true" />
        <p>{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className="licenta-stats-trend">
      <div className="licenta-stats-trend-bars" role="img" aria-label="Evoluția rezultatelor">
        {rows.map((row) => (
          <div key={row.key} className="licenta-stats-trend-bar-card">
            <strong>{`${row.score}%`}</strong>
            <div className="licenta-stats-trend-bar-track">
              <div style={{ height: `${Math.max(8, Math.min(row.score, 100))}%` }} />
            </div>
            <span title={`${row.mode || "Activitate"} · ${row.score}%`}>{row.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SubjectRows({ rows }) {
  if (!rows.length) {
    return (
      <div className="licenta-stats-empty-insight">
        <BookOpenCheck aria-hidden="true" />
        <p>Lucrează o materie pentru a vedea progresul aici.</p>
      </div>
    );
  }

  return (
    <div className="overall-stat-list">
      {rows.map((row) => (
        <article key={row.key}>
          <div>
            <strong>{row.title}</strong>
            <span>
              {`Progres ${row.progressPercent}%`}
              {row.bestTestScore ? ` · Cel mai bun test ${row.bestTestScore}%` : ""}
            </span>
          </div>
          <b>{row.lastActivityLabel || "Nou"}</b>
        </article>
      ))}
    </div>
  );
}

function LearningRows({ rows }) {
  if (!rows.length) {
    return (
      <div className="licenta-stats-empty-insight">
        <Brain aria-hidden="true" />
        <p>Folosește un material ca să îți urmărești activitatea aici.</p>
      </div>
    );
  }

  return (
    <div className="overall-stat-list">
      {rows.map((row) => (
        <article key={row.key}>
          <div>
            <strong>{row.title}</strong>
            <span>
              {`${row.attemptCount} runde`}
              {row.bestScore === null ? "" : ` · Cel mai bun scor ${row.bestScore}%`}
            </span>
          </div>
          <b>{row.lastActivityLabel || "Nou"}</b>
        </article>
      ))}
    </div>
  );
}

function getNextStep({ subjects, learning, licenta }) {
  if (learning.overview.dueFlashcards > 0) {
    return {
      title: "Ai repetiții de făcut",
      detail: `${learning.overview.dueFlashcards} flashcarduri sunt pregătite pentru recapitulare.`,
      cta: "Repetă acum",
      href: "/materiale/invata"
    };
  }

  if (!subjects.overview.activeSubjectCount && !learning.overview.activeStudySetCount && !licenta.overview.personalAttemptCount) {
    return {
      title: "Începe cu o materie",
      detail: "Alege materia pe care vrei să o lucrezi; progresul va apărea aici.",
      cta: "Alege o materie",
      href: "/materii"
    };
  }

  if (subjects.overview.activeSubjectCount) {
    return {
      title: "Continuă cu o materie",
      detail: `${subjects.overview.activeSubjectCount} materii au progres salvat.`,
      cta: "Deschide materiile",
      href: "/materii"
    };
  }

  if (learning.overview.activeStudySetCount) {
    return {
      title: "Continuă din materialele tale",
      detail: `${learning.overview.activeStudySetCount} materiale au activitate salvată.`,
      cta: "Deschide materialele",
      href: "/materiale/invata"
    };
  }

  return {
    title: "Continuă cu o simulare",
    detail: `${licenta.overview.personalAttemptCount} runde finalizate până acum.`,
    cta: "Deschide simulările",
    href: "/licenta-exam"
  };
}

function LearningStatsPanel({ learning }) {
  const flashcardRows = [
    { key: "known", label: "Știu", count: learning.overview.knownFlashcards, percent: 100 },
    { key: "weak", label: "De repetat", count: learning.overview.weakFlashcards, percent: 100 },
    { key: "due", label: "Pregătite azi", count: learning.overview.dueFlashcards, percent: 100 }
  ];

  return (
    <>
      <section className="overall-section-head">
        <div>
          <h2>Materialele tale</h2>
        </div>
        <Link className="btn-link secondary" href="/materiale/invata">
          Deschide materialele
        </Link>
      </section>

      <div className="licenta-stats-grid overall-stats-compact-grid">
        <StatCard
          icon={Gauge}
          label="Scor mediu"
          value={valueOrPending(learning.overview.personalAverageScore, "%")}
          detail={`${learning.overview.attemptCount} runde finalizate`}
        />
        <StatCard
          icon={Target}
          label="Întrebări lucrate"
          value={learning.overview.answeredQuestions}
          detail={`${learning.overview.studySetCount} materiale folosite`}
        />
        <StatCard
          icon={Brain}
          label="De repetat"
          value={learning.overview.weakFlashcards}
          detail={`${learning.overview.dueFlashcards} pregătite acum`}
        />
      </div>

      <section className="licenta-stats-main-grid overall-stats-simple-grid">
        <article className="surface licenta-stats-panel licenta-stats-panel-wide">
          <div className="licenta-stats-panel-head">
            <h3>Materiale recente</h3>
          </div>
          <LearningRows rows={learning.rows} />
        </article>

        <article className="surface licenta-stats-panel">
          <div className="licenta-stats-panel-head">
            <h3>Repetiții</h3>
          </div>
          <BarRows rows={flashcardRows} />
        </article>
      </section>
    </>
  );
}

export function OverallStatsDashboard({ stats }) {
  const [activeTab, setActiveTab] = useState("overview");
  const { licenta, subjects, learning } = stats;
  const nextStep = getNextStep({ subjects, learning, licenta });
  const answerRows = [
    {
      key: "study",
      label: "Studiu",
      count: subjects.overview.studiedQuestions,
      percent: subjects.overview.studyTotal
        ? Math.round((subjects.overview.studiedQuestions / subjects.overview.studyTotal) * 100)
        : 0
    },
    {
      key: "interactive",
      label: "Interactiv",
      count: subjects.overview.interactiveAnswered,
      percent: subjects.overview.interactiveAccuracy
    },
    {
      key: "wrong",
      label: "Greșeli",
      count: subjects.overview.interactiveWrong,
      percent: subjects.overview.interactiveAnswered
        ? Math.round((subjects.overview.interactiveWrong / subjects.overview.interactiveAnswered) * 100)
        : 0
    }
  ];

  return (
    <div className="licenta-stats-dashboard overall-stats-dashboard">
      <div
        className="overall-stats-tabs"
        role="tablist"
        aria-label="Secțiuni statistici"
        onKeyDown={handleTablistKeyDown}
      >
        {TAB_ITEMS.map((tab) => (
          <button
            key={tab.key}
            id={`overall-tab-${tab.key}`}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            aria-controls={`overall-panel-${tab.key}`}
            tabIndex={activeTab === tab.key ? 0 : -1}
            className={activeTab === tab.key ? "is-active" : ""}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" ? (
        <section id="overall-panel-overview" className="overall-tab-panel" role="tabpanel" aria-labelledby="overall-tab-overview">
          <article className="surface overall-stats-focus">
            <span className="licenta-stats-card-icon" aria-hidden="true"><Target /></span>
            <div>
              <h2>{nextStep.title}</h2>
              <p>{nextStep.detail}</p>
            </div>
            <Link className="btn-link primary" href={nextStep.href}>{nextStep.cta}</Link>
          </article>

          <div className="licenta-stats-grid overall-stats-compact-grid">
            <StatCard icon={Gauge} label="Scor mediu" value={valueOrPending(stats.overall.averageScore, "%")} />
            <StatCard icon={Target} label="Întrebări lucrate" value={stats.overall.totalActions} />
            <StatCard
              icon={GraduationCap}
              label="Materii în curs"
              value={subjects.overview.activeSubjectCount}
              detail={`${subjects.overview.subjectCount} cu progres salvat`}
            />
          </div>
        </section>
      ) : null}

      {activeTab === "materii" ? (
        <section id="overall-panel-materii" className="overall-tab-panel" role="tabpanel" aria-labelledby="overall-tab-materii">
          <section className="overall-section-head">
            <div><h2>Materiile tale</h2></div>
            <Link className="btn-link secondary" href="/materii">Deschide materiile</Link>
          </section>

          <article className="surface licenta-stats-panel">
            <div className="licenta-stats-panel-head"><h3>Progres salvat</h3></div>
            <SubjectRows rows={subjects.rows} />
          </article>

          <section className="licenta-stats-main-grid overall-stats-simple-grid">
            <article className="surface licenta-stats-panel">
              <div className="licenta-stats-panel-head">
                <h3>Răspunsuri</h3>
                <strong className="licenta-stats-big-percent">{`${subjects.overview.interactiveAccuracy}%`}</strong>
              </div>
              <BarRows rows={answerRows} />
            </article>

            <article className="surface licenta-stats-panel licenta-stats-panel-wide">
              <div className="licenta-stats-panel-head"><h3>Activitate recentă</h3></div>
              <TrendChart rows={subjects.trend} emptyLabel="Activitatea apare după ce începi să lucrezi o materie." />
            </article>
          </section>
        </section>
      ) : null}

      {activeTab === "licenta" ? (
        <section id="overall-panel-licenta" className="overall-tab-panel" role="tabpanel" aria-labelledby="overall-tab-licenta">
          <section className="overall-section-head">
            <div><h2>Simulări</h2></div>
            <Link className="btn-link primary" href="/licenta-exam">Începe o simulare</Link>
          </section>

          <div className="licenta-stats-grid overall-stats-compact-grid">
            <StatCard icon={Gauge} label="Cel mai bun scor" value={valueOrPending(licenta.overview.bestScore, "%")} />
            <StatCard icon={Target} label="Scor mediu" value={valueOrPending(licenta.overview.personalAverage, "%")} />
            <StatCard icon={GraduationCap} label="Runde finalizate" value={licenta.overview.personalAttemptCount} />
          </div>

          <article className="surface licenta-stats-panel">
            <div className="licenta-stats-panel-head"><h3>Evoluția scorurilor</h3></div>
            <TrendChart rows={licenta.trend} emptyLabel="Rezultatele apar după primele simulări finalizate." />
          </article>
        </section>
      ) : null}

      {activeTab === "invatare" ? (
        <section id="overall-panel-invatare" className="overall-tab-panel" role="tabpanel" aria-labelledby="overall-tab-invatare">
          <LearningStatsPanel learning={learning} />
        </section>
      ) : null}
    </div>
  );
}
