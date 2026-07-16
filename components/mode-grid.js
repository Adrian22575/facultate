import Link from "next/link";

import { activateWelcomePremiumAction } from "@/app/cont/actions";
import { LearningModeCard } from "@/components/learning-mode-card";

function WelcomePremiumInlineCard({ returnTo }) {
  return (
    <article className="subject-welcome-premium" aria-label="Bonus premium disponibil">
      <div className="subject-welcome-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false">
          <path d="M20 7h-2.3c.2-.5.3-1 .3-1.5A2.5 2.5 0 0 0 15.5 3c-1.4 0-2.5 1.1-3.5 2.5C11 4.1 9.9 3 8.5 3A2.5 2.5 0 0 0 6 5.5c0 .5.1 1 .3 1.5H4a1 1 0 0 0-1 1v3h18V8a1 1 0 0 0-1-1ZM8.5 5c.7 0 1.3.8 1.8 2H8.5A1.5 1.5 0 0 1 7 5.5 1.5 1.5 0 0 1 8.5 5Zm7 0A1.5 1.5 0 0 1 17 5.5 1.5 1.5 0 0 1 15.5 7h-1.8c.5-1.2 1.1-2 1.8-2ZM4 13v6a2 2 0 0 0 2 2h5v-8H4Zm9 8h5a2 2 0 0 0 2-2v-6h-7v8Z" />
        </svg>
      </div>
      <div className="subject-welcome-copy">
        <strong>Ai 24h Premium cadou</strong>
        <span>Activeaza si foloseste Interactiv, Studiaza si Test.</span>
      </div>
      <form action={activateWelcomePremiumAction} className="subject-welcome-form">
        <input type="hidden" name="returnTo" value={returnTo} />
        <button type="submit">Activeaza acum</button>
      </form>
      <span className="subject-welcome-note">Porneste doar dupa activare.</span>
    </article>
  );
}

export function ModeGrid({
  subject,
  locked = false,
  lockHref = "/cont?section=plans&lock=learning_modes",
  showWelcomePremium = false,
  welcomeReturnTo = `/materii/${subject.id}`,
  welcomeState = null
}) {
  const lockMessage = "Ai nevoie de plan activ pentru Interactiv, Studiaza si Test.";
  const showPlanFallback = locked && !showWelcomePremium;

  return (
    <section className="mode-grid-panel">
      {welcomeState === "activated" ? (
        <div className="subject-welcome-success" role="status">
          Premium activ. Spor la invatat!
        </div>
      ) : null}
      {locked ? (
        showWelcomePremium ? null : (
          <div className="mode-lock-banner" role="status">
            <strong>Plan activ necesar</strong>
            <p>{lockMessage}</p>
          </div>
        )
      ) : null}
      {showWelcomePremium ? (
        <WelcomePremiumInlineCard returnTo={welcomeReturnTo} />
      ) : null}
      <div className="mode-grid" aria-label="Moduri disponibile">
        <LearningModeCard
          href={`/materii/${subject.id}/interactiv`}
          mode="interactive"
          eyebrow="Rapid"
          title="Interactiv"
          description="Raspunzi si vezi imediat."
          variant="compact"
          primary
          disabled={locked}
        />
        <LearningModeCard
          href={`/materii/${subject.id}/studiu`}
          mode="study"
          eyebrow="Calm"
          title="Studiaza"
          description="Vezi tot, fara graba."
          variant="compact"
          disabled={locked}
        />
        <LearningModeCard
          href={`/materii/${subject.id}/test`}
          mode="test"
          eyebrow="Verificare"
          title="Test"
          description="Te verifici rapid."
          variant="compact"
          disabled={locked}
        />
      </div>
      {showPlanFallback ? (
        <div className="mode-lock-actions">
          <p>{lockMessage}</p>
          <Link className="btn-back" href={lockHref}>
            Alege un plan
          </Link>
        </div>
      ) : null}
      {locked && showWelcomePremium ? (
        <div className="mode-lock-actions mode-lock-actions-soft">
          <p>Nu vrei bonusul acum?</p>
          <Link className="btn-back" href={lockHref}>
            Vezi planuri
          </Link>
        </div>
      ) : null}
    </section>
  );
}
