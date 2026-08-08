"use client";

import { Trophy } from "lucide-react";

import { ActionLink } from "@/components/ui/action";

import styles from "./gamification-result-panel.module.css";

export function GamificationResultPanel({ result }) {
  if (!result || !result.created) return null;

  const unlocked = Array.isArray(result.unlockedAchievements)
    ? result.unlockedAchievements
    : [];
  const currentLevel = result.level?.current || null;
  const nextLevel = result.level?.next || null;
  const progressPercent = result.level?.progressPercent || 0;

  return (
    <section className={styles["gamification-result-panel"]} aria-label="Progres primit">
      <span className={styles["gamification-result-icon"]} aria-hidden="true">
        <Trophy size={20} strokeWidth={2.4} />
      </span>
      <div>
        <strong>{`+${result.pointsAwarded} puncte pentru runda asta`}</strong>
        <p>
          {`Total: ${result.totalPoints} puncte. Streak actual: ${result.currentStreak} zile.`}
        </p>
        <div className={styles["gamification-result-level"]}>
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
        <div className={styles["gamification-result-track"]} aria-label="Progres catre urmatorul nivel">
          <span style={{ width: `${progressPercent}%` }} />
        </div>
        {unlocked.length ? (
          <div className={styles["gamification-unlocked-list"]}>
            {unlocked.map((achievement) => (
              <span key={achievement.key}>
                {`${achievement.title}${achievement.bonusPoints ? ` +${achievement.bonusPoints}` : ""}`}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <ActionLink
        variant="secondary"
        className={styles["gamification-result-link"]}
        href="/progresul-meu"
      >
        Vezi progresul
      </ActionLink>
    </section>
  );
}
