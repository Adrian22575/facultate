import Link from "next/link";
import { CheckCircle2, Lock, Trophy } from "lucide-react";

function formatDate(value) {
  if (!value) return "Inca nu";
  try {
    return new Intl.DateTimeFormat("ro-RO", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    }).format(new Date(value));
  } catch {
    return "Recent";
  }
}

function actionLabel(actionType) {
  if (actionType === "subject_test_completed") return "Test pe materie";
  if (actionType === "learning_quiz_completed") return "Test din material";
  if (actionType === "learning_mistakes_completed") return "Greseli din material";
  if (actionType === "licenta_simulation_completed") return "Simulare licenta";
  if (actionType === "licenta_mistakes_completed") return "Greseli licenta";
  if (actionType === "achievement_unlocked") return "Realizare deblocata";
  return "Activitate de invatare";
}

export function GamificationProgressPage({ summary }) {
  const level = summary.level?.current;
  const nextLevel = summary.level?.next;
  const unlocked = summary.achievements.filter((achievement) => achievement.unlocked);
  const locked = summary.achievements.filter((achievement) => !achievement.unlocked);

  return (
    <div className="gamification-page">
      <section className="gamification-hero surface">
        <div>
          <span className="ui-section-label">Progres</span>
          <h1>{level?.title || "Incepator"}</h1>
          <p>{summary.todayMessage}</p>
        </div>
        <div className="gamification-hero-badge" aria-hidden="true">
          <Trophy size={32} strokeWidth={2.4} />
          <span>{level?.badge || "1"}</span>
        </div>
      </section>

      <section className="gamification-kpi-grid">
        <article className="surface">
          <span>Puncte totale</span>
          <strong>{summary.totalPoints}</strong>
        </article>
        <article className="surface">
          <span>Streak actual</span>
          <strong>{`${summary.currentStreak} zile`}</strong>
        </article>
        <article className="surface">
          <span>Cel mai bun streak</span>
          <strong>{`${summary.bestStreak} zile`}</strong>
        </article>
        <article className="surface">
          <span>Astazi</span>
          <strong>{summary.todayCompleted ? "Completat" : "De facut"}</strong>
        </article>
      </section>

      <section className="surface gamification-level-card">
        <div className="learning-upload-section-head">
          <div>
            <span className="ui-section-label">Nivel</span>
            <h2>{nextLevel ? `Urmatorul nivel: ${nextLevel.title}` : "Ai atins nivelul maxim"}</h2>
          </div>
          <span className="status-pill is-muted">
            {nextLevel ? `${summary.level.pointsToNext} puncte ramase` : "Maxim"}
          </span>
        </div>
        <div className="gamification-level-track" aria-label="Progres catre urmatorul nivel">
          <span style={{ width: `${summary.level?.progressPercent || 0}%` }} />
        </div>
        <p>
          {summary.milestone.next
            ? `Inca ${summary.milestone.daysToNext} zile pana la streak-ul de ${summary.milestone.next} zile.`
            : "Ai trecut de milestone-urile principale de streak."}
        </p>
      </section>

      <section className="gamification-layout">
        <div className="surface gamification-achievements-card">
          <div className="learning-upload-section-head">
            <div>
              <span className="ui-section-label">Realizari</span>
              <h2>Deblocate</h2>
            </div>
            <span className="status-pill is-good">{unlocked.length}</span>
          </div>
          {unlocked.length ? (
            <div className="gamification-achievement-list">
              {unlocked.map((achievement) => (
                <article key={achievement.key} className="is-unlocked">
                  <span>{achievement.badge}</span>
                  <div>
                    <strong>{achievement.title}</strong>
                    <p>{achievement.description}</p>
                    <small>{`Deblocat: ${formatDate(achievement.unlockedAt)}`}</small>
                  </div>
                  <CheckCircle2 aria-hidden="true" />
                </article>
              ))}
            </div>
          ) : (
            <div className="learning-upload-empty">
              <strong>Nu ai realizari deblocate inca.</strong>
              <p>Finalizeaza un test si primele badge-uri apar aici.</p>
            </div>
          )}
        </div>

        <aside className="surface gamification-achievements-card">
          <div className="learning-upload-section-head">
            <div>
              <span className="ui-section-label">Urmeaza</span>
              <h2>Blocate</h2>
            </div>
          </div>
          <div className="gamification-achievement-list">
            {locked.slice(0, 6).map((achievement) => (
              <article key={achievement.key}>
                <span>{achievement.badge}</span>
                <div>
                  <strong>{achievement.title}</strong>
                  <p>{achievement.description}</p>
                  {achievement.bonusPoints ? <small>{`Bonus: ${achievement.bonusPoints} puncte`}</small> : null}
                </div>
                <Lock aria-hidden="true" />
              </article>
            ))}
          </div>
        </aside>
      </section>

      <section className="surface gamification-activity-card">
        <div className="learning-upload-section-head">
          <div>
            <span className="ui-section-label">Activitate</span>
            <h2>Puncte recente</h2>
          </div>
          <Link className="btn-link secondary" href="/">
            Inapoi la dashboard
          </Link>
        </div>
        {summary.recentTransactions.length ? (
          <div className="gamification-activity-list">
            {summary.recentTransactions.map((item) => (
              <article key={item.id}>
                <div>
                  <strong>{actionLabel(item.actionType)}</strong>
                  <span>{formatDate(item.createdAt)}</span>
                </div>
                <b>{`+${item.points}`}</b>
              </article>
            ))}
          </div>
        ) : (
          <div className="learning-upload-empty">
            <strong>Nu ai tranzactii de puncte inca.</strong>
            <p>Finalizeaza o runda reala de invatare pentru a porni progresul.</p>
          </div>
        )}
      </section>
    </div>
  );
}
