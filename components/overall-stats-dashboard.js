"use client";

import Link from "next/link";
import { useState } from "react";
import {
  BarChart3,
  BookOpenCheck,
  Brain,
  Gauge,
  GraduationCap,
  PieChart,
  Target,
  Trophy
} from "lucide-react";

import { handleTablistKeyDown } from "@/lib/ui/tablist";

const DONUT_COLORS = ["#2563eb", "#16a34a", "#f97316", "#7c3aed", "#dc2626"];
const TAB_ITEMS = [
  { key: "overview", label: "Overview" },
  { key: "competitie", label: "Competitie" },
  { key: "licenta", label: "Licenta" },
  { key: "materii", label: "Materii" },
  { key: "invatare", label: "Invatare" }
];

function valueOrPending(value, suffix = "") {
  return value === null || value === undefined ? "In curs" : `${value}${suffix}`;
}

function createDonutGradient(rows) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  if (!total) return "#e5edf7";

  let cursor = 0;
  return rows
    .map((row, index) => {
      const start = cursor;
      const end = cursor + (row.count / total) * 100;
      cursor = end;
      return `${DONUT_COLORS[index % DONUT_COLORS.length]} ${start}% ${end}%`;
    })
    .join(", ");
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

function BarRows({ rows, emptyLabel = "Nu exista inca date." }) {
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

function Donut({ rows, centerLabel = "runde" }) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);

  return (
    <div className="licenta-stats-donut-wrap">
      <div
        className="licenta-stats-donut"
        style={{ "--licenta-donut": `conic-gradient(${createDonutGradient(rows)})` }}
        aria-label="Distributie"
      >
        <div>
          <strong>{total}</strong>
          <span>{centerLabel}</span>
        </div>
      </div>
      <div className="licenta-stats-legend">
        {rows.length ? (
          rows.map((row, index) => (
            <div key={row.key}>
              <span
                className="licenta-stats-legend-dot"
                style={{ background: DONUT_COLORS[index % DONUT_COLORS.length] }}
              />
              <span>{row.label}</span>
              <strong>{`${row.percent}%`}</strong>
            </div>
          ))
        ) : (
          <p className="licenta-stats-empty-line">Datele apar dupa primele actiuni.</p>
        )}
      </div>
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
      <div className="licenta-stats-trend-bars" role="img" aria-label="Evolutie scoruri">
        {rows.map((row) => (
          <div key={row.key} className="licenta-stats-trend-bar-card">
            <strong>{`${row.score}%`}</strong>
            <div className="licenta-stats-trend-bar-track">
              <div style={{ height: `${Math.max(8, Math.min(row.score, 100))}%` }} />
            </div>
            <span>{row.label}</span>
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
        <p>Lucreaza o materie in Studiu, Interactiv sau Test ca sa apara statistici aici.</p>
      </div>
    );
  }

  return (
    <div className="overall-subject-table">
      {rows.map((row) => (
        <article key={row.key}>
          <div>
            <strong>{row.title}</strong>
            <span>{row.lastActivityLabel ? `Ultima activitate: ${row.lastActivityLabel}` : "Activitate noua"}</span>
          </div>
          <div>
            <span>Progres</span>
            <b>{`${row.progressPercent}%`}</b>
          </div>
          <div>
            <span>Test</span>
            <b>{row.bestTestScore ? `${row.bestTestScore}%` : "In curs"}</b>
          </div>
          <div>
            <span>Comunitate</span>
            <b>{row.communityAverageTest ? `${row.communityAverageTest}%` : "In curs"}</b>
          </div>
        </article>
      ))}
    </div>
  );
}

function ComparisonCard({ label, you, community, suffix = "" }) {
  const maxValue = Math.max(you, community, 1);

  return (
    <article className="competition-comparison-card">
      <h3>{label}</h3>
      <div className="competition-compare-row is-you">
        <span>Tu</span>
        <div>
          <i style={{ width: `${Math.max(you ? 8 : 0, (you / maxValue) * 100)}%` }} />
        </div>
        <strong>{`${you}${suffix}`}</strong>
      </div>
      <div className="competition-compare-row">
        <span>Media celorlalti</span>
        <div>
          <i style={{ width: `${Math.max(community ? 8 : 0, (community / maxValue) * 100)}%` }} />
        </div>
        <strong>{`${community}${suffix}`}</strong>
      </div>
    </article>
  );
}

function Leaderboard({ title, rows, emptyLabel }) {
  if (!rows.length) {
    return (
      <article className="surface licenta-stats-panel">
        <div className="licenta-stats-panel-head">
          <div>
            <span className="ui-section-label">Top</span>
            <h3>{title}</h3>
          </div>
        </div>
        <p className="licenta-stats-empty-line">{emptyLabel}</p>
      </article>
    );
  }

  return (
    <article className="surface licenta-stats-panel">
      <div className="licenta-stats-panel-head">
        <div>
          <span className="ui-section-label">Top</span>
          <h3>{title}</h3>
        </div>
      </div>
      <div className="competition-leaderboard">
        {rows.map((row) => (
          <div key={`${title}-${row.userId}`} className={row.isCurrentUser ? "is-current-user" : ""}>
            <span>{row.rank}</span>
            <strong>{row.label}</strong>
            <em>{row.activityLabel || `${row.effort} intrebari`}</em>
            <b>{row.averageScore ? `${row.averageScore}%` : "scor in curs"}</b>
          </div>
        ))}
      </div>
    </article>
  );
}

function LearningRows({ rows }) {
  if (!rows.length) {
    return (
      <div className="licenta-stats-empty-insight">
        <Brain aria-hidden="true" />
        <p>Incarca o materie sau foloseste un material din comunitate ca sa vezi progresul aici.</p>
      </div>
    );
  }

  return (
    <div className="overall-subject-table">
      {rows.map((row) => (
        <article key={row.key}>
          <div>
            <strong>{row.title}</strong>
            <span>{row.lastActivityLabel ? `Ultima activitate: ${row.lastActivityLabel}` : "Material pregatit"}</span>
          </div>
          <div>
            <span>Runde</span>
            <b>{row.attemptCount}</b>
          </div>
          <div>
            <span>Scor</span>
            <b>{row.bestScore === null ? "In curs" : `${row.bestScore}%`}</b>
          </div>
          <div>
            <span>Comunitate</span>
            <b>{row.communityAverage ? `${row.communityAverage}%` : "In curs"}</b>
          </div>
        </article>
      ))}
    </div>
  );
}

function LearningStatsPanel({ learning }) {
  const reviewedFlashcards = Math.max(
    learning.overview.knownFlashcards + learning.overview.weakFlashcards,
    1
  );
  const flashcardRows = [
    {
      key: "known",
      label: "Stiu",
      count: learning.overview.knownFlashcards,
      percent: Math.round((learning.overview.knownFlashcards / reviewedFlashcards) * 100)
    },
    {
      key: "weak",
      label: "De repetat",
      count: learning.overview.weakFlashcards,
      percent: Math.round((learning.overview.weakFlashcards / reviewedFlashcards) * 100)
    },
    {
      key: "due",
      label: "Scadente azi",
      count: learning.overview.dueFlashcards,
      percent: Math.round((learning.overview.dueFlashcards / reviewedFlashcards) * 100)
    }
  ];

  return (
    <>
      <section className="overall-section-head">
        <div>
          <span className="ui-section-label">Invatare</span>
          <h2>Progres din materialele tale</h2>
        </div>
        <Link className="btn-link secondary" href="/materiale/invata">
          Deschide materialele
        </Link>
      </section>

      <div className="licenta-stats-grid">
        <StatCard
          icon={BookOpenCheck}
          label="Materiale folosite"
          value={learning.overview.studySetCount}
          detail={`${learning.overview.activeStudySetCount} cu progres salvat`}
        />
        <StatCard
          icon={Gauge}
          label="Scor mediu"
          value={valueOrPending(learning.overview.personalAverageScore, "%")}
          detail={`Comunitate: ${learning.overview.communityAverageScore}%`}
        />
        <StatCard
          icon={Target}
          label="Intrebari rezolvate"
          value={learning.overview.answeredQuestions}
          detail={`${learning.overview.attemptCount} runde finalizate`}
        />
        <StatCard
          icon={Brain}
          label="Repetari flashcard"
          value={learning.overview.flashcardReviewCount}
          detail={`${learning.overview.weakFlashcards} de repetat`}
        />
      </div>

      <section className="competition-compare-grid">
        <ComparisonCard
          label="Scor la testele de invatare"
          you={learning.overview.personalAverageScore}
          community={learning.overview.communityAverageScore}
          suffix="%"
        />
        <ComparisonCard
          label="Intrebari rezolvate"
          you={learning.overview.answeredQuestions}
          community={learning.overview.communityAverageQuestions}
          suffix=" intrebari"
        />
      </section>

      <section className="licenta-stats-main-grid">
        <article className="surface licenta-stats-panel licenta-stats-panel-wide">
          <div className="licenta-stats-panel-head">
            <div>
              <span className="ui-section-label">Materiale</span>
              <h3>Activitatea ta recenta</h3>
            </div>
            <span className="overall-section-meta">{learning.scopeLabel}</span>
          </div>
          <LearningRows rows={learning.rows} />
        </article>

        <article className="surface licenta-stats-panel">
          <div className="licenta-stats-panel-head">
            <div>
              <span className="ui-section-label">Mix</span>
              <h3>Cum inveti</h3>
            </div>
          </div>
          <Donut rows={learning.modeMix} centerLabel="actiuni" />
        </article>

        <article className="surface licenta-stats-panel">
          <div className="licenta-stats-panel-head">
            <div>
              <span className="ui-section-label">Flashcards</span>
              <h3>Ce trebuie repetat</h3>
            </div>
          </div>
          <BarRows rows={flashcardRows} />
        </article>

        <article className="surface licenta-stats-panel licenta-stats-panel-wide">
          <div className="licenta-stats-panel-head">
            <div>
              <span className="ui-section-label">Evolutie</span>
              <h3>Scorurile recente</h3>
            </div>
          </div>
          <TrendChart
            rows={learning.trend}
            emptyLabel="Evolutia apare dupa primele teste finalizate din materialele de invatare."
          />
        </article>
      </section>
    </>
  );
}

export function OverallStatsDashboard({ stats }) {
  const [activeTab, setActiveTab] = useState("overview");
  const licenta = stats.licenta;
  const subjects = stats.subjects;
  const competition = stats.competition;
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
      label: "Greseli",
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
        aria-label="Sectiuni statistici"
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
        <section
          id="overall-panel-overview"
          className="overall-tab-panel"
          role="tabpanel"
          aria-labelledby="overall-tab-overview"
        >
          <div className="licenta-stats-grid">
            <StatCard
              icon={Gauge}
              label="Scor mediu"
              value={valueOrPending(stats.overall.averageScore, "%")}
              detail={`Comunitate: ${stats.overall.communityAverageScore || 0}%`}
            />
            <StatCard
              icon={Target}
              label="Actiuni totale"
              value={stats.overall.totalActions}
              detail="Runde, intrebari studiate si raspunsuri"
            />
            <StatCard
              icon={GraduationCap}
              label="Materii active"
              value={subjects.overview.activeSubjectCount}
              detail={`${subjects.overview.subjectCount} materii cu progres salvat`}
            />
            <StatCard
              icon={Trophy}
              label="Licenta"
              value={valueOrPending(licenta.overview.bestScore, "%")}
              detail={`${licenta.overview.personalAttemptCount} runde finalizate`}
            />
          </div>

          <section className="licenta-stats-main-grid">
            <article className="surface licenta-stats-panel">
              <div className="licenta-stats-panel-head">
                <div>
                  <span className="ui-section-label">Licenta</span>
                  <h3>Rezumat rapid</h3>
                </div>
              </div>
              <BarRows rows={licenta.communityDistribution} />
            </article>

            <article className="surface licenta-stats-panel">
              <div className="licenta-stats-panel-head">
                <div>
                  <span className="ui-section-label">Materii</span>
                  <h3>Studiu vs test</h3>
                </div>
              </div>
              <Donut rows={subjects.modeMix} centerLabel="zone" />
            </article>

            <article className="surface licenta-stats-panel">
              <div className="licenta-stats-panel-head">
                <div>
                  <span className="ui-section-label">Urmatorul pas</span>
                  <h3>Ce merita urmarit</h3>
                </div>
              </div>
              <div className="licenta-stats-next-step">
                <Target aria-hidden="true" />
                <p>
                  Verifica zona unde ai mai putine date: licenta pentru simulari, materii pentru progres
                  pe cursuri sau invatare pentru flashcards, teste si repetarea zonelor slabe.
                </p>
              </div>
            </article>
          </section>
        </section>
      ) : null}

      {activeTab === "competitie" ? (
        <section
          id="overall-panel-competitie"
          className="overall-tab-panel"
          role="tabpanel"
          aria-labelledby="overall-tab-competitie"
        >
          <section className="overall-section-head">
            <div>
              <span className="ui-section-label">Competitie</span>
              <h2>Tu vs comunitatea ta</h2>
            </div>
            <span className="overall-section-meta">{`${competition.participantCount} participanti`}</span>
          </section>

          <section className="competition-compare-grid">
            <ComparisonCard
              label="Munca totala"
              you={competition.currentUser.effort}
              community={competition.community.averageEffort}
              suffix=" intrebari"
            />
            <ComparisonCard
              label="Munca saptamana asta"
              you={competition.currentUser.weekEffort}
              community={competition.community.weekAverageEffort}
              suffix=" intrebari"
            />
            <ComparisonCard
              label="Media rezultatelor"
              you={competition.currentUser.averageScore}
              community={competition.community.averageScore}
              suffix="%"
            />
          </section>

          <section className="licenta-stats-main-grid">
            <Leaderboard
              title="Saptamana asta"
              rows={competition.topWeek}
              emptyLabel="Topul saptamanal apare dupa ce comunitatea lucreaza in perioada curenta."
            />
            <Leaderboard
              title="Luna aceasta"
              rows={competition.topMonth}
              emptyLabel="Topul lunar apare dupa mai multe runde si activitati recente."
            />
            <Leaderboard
              title="Overall"
              rows={competition.topOverall}
              emptyLabel="Topul overall apare dupa primele rezultate salvate."
            />
          </section>
        </section>
      ) : null}

      {activeTab === "licenta" ? (
        <section
          id="overall-panel-licenta"
          className="overall-tab-panel"
          role="tabpanel"
          aria-labelledby="overall-tab-licenta"
        >
          <section className="overall-section-head">
            <div>
              <span className="ui-section-label">Licenta</span>
              <h2>Simulari si comparatie cu comunitatea</h2>
            </div>
            <Link className="btn-link secondary" href="/licenta-exam">
              Runda noua
            </Link>
          </section>

          <section className="licenta-stats-main-grid">
            <article className="surface licenta-stats-panel licenta-stats-panel-wide">
              <div className="licenta-stats-panel-head">
                <div>
                  <span className="ui-section-label">Evolutie</span>
                  <h3>Scorurile recente la licenta</h3>
                </div>
                <span className="overall-section-meta">{`${licenta.overview.activeDays} zile active`}</span>
              </div>
              <TrendChart rows={licenta.trend} emptyLabel="Fa cateva runde de licenta ca sa vezi evolutia scorului." />
            </article>

            <article className="surface licenta-stats-panel">
              <div className="licenta-stats-panel-head">
                <div>
                  <span className="ui-section-label">Comunitate</span>
                  <h3>Distributia scorurilor</h3>
                </div>
              </div>
              <BarRows rows={licenta.communityDistribution} />
            </article>

            <article className="surface licenta-stats-panel">
              <div className="licenta-stats-panel-head">
                <div>
                  <span className="ui-section-label">Moduri</span>
                  <h3>Cum te antrenezi</h3>
                </div>
              </div>
              <Donut rows={licenta.personalModeBreakdown} />
            </article>
          </section>
        </section>
      ) : null}

      {activeTab === "materii" ? (
        <section
          id="overall-panel-materii"
          className="overall-tab-panel"
          role="tabpanel"
          aria-labelledby="overall-tab-materii"
        >
          <section className="overall-section-head">
            <div>
              <span className="ui-section-label">Teste pe materii</span>
              <h2>Progres pe materii, test si interactiv</h2>
            </div>
          </section>

          <section className="licenta-stats-main-grid">
            <article className="surface licenta-stats-panel licenta-stats-panel-wide">
              <div className="licenta-stats-panel-head">
                <div>
                  <span className="ui-section-label">Materii</span>
                  <h3>Cele mai active materii</h3>
                </div>
                <span className="overall-section-meta">{subjects.scopeLabel}</span>
              </div>
              <SubjectRows rows={subjects.rows} />
            </article>

            <article className="surface licenta-stats-panel">
              <div className="licenta-stats-panel-head">
                <div>
                  <span className="ui-section-label">Mix</span>
                  <h3>Studiu vs test</h3>
                </div>
              </div>
              <Donut rows={subjects.modeMix} centerLabel="zone" />
            </article>

            <article className="surface licenta-stats-panel">
              <div className="licenta-stats-panel-head">
                <div>
                  <span className="ui-section-label">Raspunsuri</span>
                  <h3>Volum si acuratete</h3>
                </div>
                <strong className="licenta-stats-big-percent">{`${subjects.overview.interactiveAccuracy}%`}</strong>
              </div>
              <BarRows rows={answerRows} />
            </article>

            <article className="surface licenta-stats-panel licenta-stats-panel-wide">
              <div className="licenta-stats-panel-head">
                <div>
                  <span className="ui-section-label">Evolutie materii</span>
                  <h3>Progresul recent salvat</h3>
                </div>
              </div>
              <TrendChart rows={subjects.trend} emptyLabel="Progresul pe materii apare dupa Studiu, Interactiv sau Test." />
            </article>
          </section>
        </section>
      ) : null}

      {activeTab === "invatare" ? (
        <section
          id="overall-panel-invatare"
          className="overall-tab-panel"
          role="tabpanel"
          aria-labelledby="overall-tab-invatare"
        >
          <LearningStatsPanel learning={stats.learning} />
        </section>
      ) : null}
    </div>
  );
}
