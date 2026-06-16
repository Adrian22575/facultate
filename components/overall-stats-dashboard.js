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

function LearningFuturePanel({ learning }) {
  return (
    <article className="surface licenta-stats-panel overall-learning-panel" id="invatare">
      <div className="licenta-stats-panel-head">
        <div>
          <span className="ui-section-label">In curand</span>
          <h3>{learning.title}</h3>
        </div>
        <span className="status-pill is-muted">Pregatit pentru modulul nou</span>
      </div>
      <div className="overall-learning-grid">
        {["Capitole", "Flashcards", "Plan", "Zone slabe"].map((item) => (
          <div key={item}>
            <Brain aria-hidden="true" />
            <strong>{item}</strong>
          </div>
        ))}
      </div>
      <p className="page-copy">{learning.description}</p>
    </article>
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
      <div className="overall-stats-tabs" role="tablist" aria-label="Sectiuni statistici">
        {TAB_ITEMS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            className={activeTab === tab.key ? "is-active" : ""}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" ? (
        <section className="overall-tab-panel" role="tabpanel">
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
                  Verifica tabul unde ai mai putine date: licenta pentru simulari, materii pentru progres
                  pe cursuri, invatare pentru modulul care urmeaza.
                </p>
              </div>
            </article>
          </section>
        </section>
      ) : null}

      {activeTab === "competitie" ? (
        <section className="overall-tab-panel" role="tabpanel">
          <section className="overall-section-head">
            <div>
              <span className="ui-section-label">Competitie</span>
              <h2>Tu vs comunitatea ta</h2>
            </div>
            <span className="status-pill is-muted">{`${competition.participantCount} participanti`}</span>
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
        <section className="overall-tab-panel" role="tabpanel">
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
                <span className="status-pill is-muted">{`${licenta.overview.activeDays} zile active`}</span>
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
        <section className="overall-tab-panel" role="tabpanel">
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
                <span className="status-pill is-muted">{subjects.scopeLabel}</span>
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
        <section className="overall-tab-panel" role="tabpanel">
          <LearningFuturePanel learning={stats.learning} />
        </section>
      ) : null}
    </div>
  );
}
