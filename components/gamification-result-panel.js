"use client";

import Link from "next/link";
import { Trophy } from "lucide-react";

export function GamificationResultPanel({ result }) {
  if (!result || !result.created) return null;

  const unlocked = Array.isArray(result.unlockedAchievements)
    ? result.unlockedAchievements
    : [];
  const currentLevel = result.level?.current || null;
  const nextLevel = result.level?.next || null;
  const progressPercent = result.level?.progressPercent || 0;

  return (
    <section className="gamification-result-panel" aria-label="Progres primit">
      <span className="gamification-result-icon" aria-hidden="true">
        <Trophy size={20} strokeWidth={2.4} />
      </span>
      <div>
        <strong>{`+${result.pointsAwarded} puncte pentru runda asta`}</strong>
        <p>
          {`Total: ${result.totalPoints} puncte. Streak actual: ${result.currentStreak} zile.`}
        </p>
        <div className="gamification-result-level">
          <span>
            {currentLevel
              ? `Nivel: ${currentLevel.title}`
              : "Nivel: Incepator"}
          </span>
          <span>
            {nextLevel
              ? `${result.level.pointsToNext} puncte pana la ${nextLevel.title}`
              : "Nivel maxim atins"}
          </span>
        </div>
        <div className="gamification-result-track" aria-label="Progres catre urmatorul nivel">
          <span style={{ width: `${progressPercent}%` }} />
        </div>
        {unlocked.length ? (
          <div className="gamification-unlocked-list">
            {unlocked.map((achievement) => (
              <span key={achievement.key}>
                {`${achievement.title}${achievement.bonusPoints ? ` +${achievement.bonusPoints}` : ""}`}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <Link className="btn-link secondary gamification-result-link" href="/progresul-meu">
        Vezi progresul
      </Link>
    </section>
  );
}
