"use client";

import Link from "next/link";
import { Trophy } from "lucide-react";

export function GamificationResultPanel({ result }) {
  if (!result || !result.created) return null;

  const unlocked = Array.isArray(result.unlockedAchievements)
    ? result.unlockedAchievements
    : [];

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
