import { ArrowRight, CheckCircle2, Flame, Lock, Target, Trophy } from "lucide-react";

import { PendingNavigationLink } from "@/components/pending-navigation-link";

function formatDate(value) {
  if (!value) return "Încă nu";
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
  if (actionType === "learning_mistakes_completed") return "Greșeli din material";
  if (actionType === "licenta_simulation_completed") return "Simulare licență";
  if (actionType === "licenta_mistakes_completed") return "Greșeli licență";
  if (actionType === "achievement_unlocked") return "Realizare deblocată";
  return "Activitate de învățare";
}

function ContinueLearningAction({ completedToday }) {
  return (
    <PendingNavigationLink
      className="gamification-primary-action"
      href="/materii"
      pendingLabel="Se deschid materiile..."
      pendingMode="replace"
    >
      <span>{completedToday ? "Continuă să înveți" : "Alege o materie"}</span>
      <ArrowRight aria-hidden="true" size={18} strokeWidth={2.4} />
    </PendingNavigationLink>
  );
}

export function GamificationProgressPage({ summary }) {
  const level = summary.level?.current;
  const nextLevel = summary.level?.next;
  const unlocked = summary.achievements.filter((achievement) => achievement.unlocked);
  const nextAchievement = summary.achievements.find((achievement) => !achievement.unlocked) || null;
  const todayTitle = summary.todayCompleted ? "Ai învățat astăzi" : "Păstrează-ți seria";
  const todayCopy = summary.todayCompleted
    ? "Ai bifat deja o rundă. Poți continua cu materia care contează cel mai mult acum."
    : "Alege o materie și finalizează o rundă pentru a-ți păstra seria activă.";
  const nextLevelCopy = nextLevel
    ? `${summary.level.pointsToNext} puncte până la ${nextLevel.title}`
    : "Ai ajuns la nivelul maxim.";

  return (
    <div className="gamification-page">
      <section className="gamification-hero surface">
        <div className="gamification-hero-copy">
          <span className="ui-section-label">Astăzi</span>
          <h1>{todayTitle}</h1>
          <p>{todayCopy}</p>
          <ContinueLearningAction completedToday={summary.todayCompleted} />
        </div>

        <div className="gamification-level-summary" aria-label={`Nivel ${level?.title || "Începător"}`}>
          <span className="gamification-level-icon" aria-hidden="true">
            <Trophy size={22} strokeWidth={2.3} />
          </span>
          <div>
            <span>Nivelul tău</span>
            <strong>{level?.title || "Începător"}</strong>
            <small>{nextLevelCopy}</small>
            <div className="gamification-level-track" aria-label="Progres către următorul nivel">
              <span style={{ width: `${summary.level?.progressPercent || 0}%` }} />
            </div>
          </div>
        </div>
      </section>

      <section className="gamification-rhythm-grid" aria-label="Ritmul tău de învățare">
        <article className="surface gamification-rhythm-card">
          <span className="gamification-rhythm-icon is-warm" aria-hidden="true">
            <Flame size={20} strokeWidth={2.35} />
          </span>
          <div>
            <span>Seria curentă</span>
            <strong>{`${summary.currentStreak} ${summary.currentStreak === 1 ? "zi" : "zile"}`}</strong>
            <small>
              {summary.currentStreak === 0
                ? "Începe azi o serie de învățare."
                : summary.bestStreak > summary.currentStreak
                ? `Recordul tău este de ${summary.bestStreak} zile.`
                : "Acesta este cel mai bun ritm al tău."}
            </small>
          </div>
        </article>
        <article className="surface gamification-rhythm-card">
          <span className="gamification-rhythm-icon" aria-hidden="true">
            <Target size={20} strokeWidth={2.35} />
          </span>
          <div>
            <span>Puncte acumulate</span>
            <strong>{summary.totalPoints}</strong>
            <small>{`${unlocked.length} ${unlocked.length === 1 ? "realizare deblocată" : "realizări deblocate"}`}</small>
          </div>
        </article>
      </section>

      {nextAchievement ? (
        <section className="surface gamification-next-card">
          <span className="gamification-next-icon" aria-hidden="true">
            <Target size={20} strokeWidth={2.3} />
          </span>
          <div className="gamification-next-copy">
            <span className="ui-section-label">Următorul obiectiv</span>
            <h2>{nextAchievement.title}</h2>
            <p>{nextAchievement.description}</p>
          </div>
          <span className="gamification-next-bonus">{`+${nextAchievement.bonusPoints} puncte`}</span>
        </section>
      ) : null}

      <details className="gamification-details">
        <summary>
          <span>
            <strong>Realizări și activitate</strong>
            <small>{`${unlocked.length} realizări deblocate`}</small>
          </span>
          <span className="gamification-details-marker" aria-hidden="true">+</span>
        </summary>

        <div className="gamification-details-content">
          {unlocked.length ? (
            <section>
              <h2>Realizări deblocate</h2>
              <div className="gamification-achievement-list">
                {unlocked.map((achievement) => (
                  <article key={achievement.key} className="is-unlocked">
                    <span>{achievement.badge}</span>
                    <div>
                      <strong>{achievement.title}</strong>
                      <p>{achievement.description}</p>
                      <small>{`Deblocată: ${formatDate(achievement.unlockedAt)}`}</small>
                    </div>
                    <CheckCircle2 aria-hidden="true" />
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          <section>
            <h2>Activitate recentă</h2>
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
              <p className="gamification-empty-copy">Prima rundă finalizată va apărea aici.</p>
            )}
          </section>

          {!unlocked.length ? (
            <div className="gamification-empty-copy">
              <Lock aria-hidden="true" size={18} />
              <span>Realizările apar pe măsură ce înveți.</span>
            </div>
          ) : null}
        </div>
      </details>
    </div>
  );
}
