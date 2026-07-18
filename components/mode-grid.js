import { activateWelcomePremiumAction } from "@/app/cont/actions";
import { LearningModeCard } from "@/components/learning-mode-card";
import { PendingNavigationLink } from "@/components/pending-navigation-link";

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
  const lockMessage = "Alege un plan pentru Interactiv, Studiu si Test.";

  return (
    <section className="mode-grid-panel">
      {welcomeState === "activated" ? (
        <div className="subject-welcome-success" role="status">
          Premium activ. Spor la invatat!
        </div>
      ) : null}
      {locked ? <div className="mode-lock-banner" role="status"><strong>Plan activ necesar</strong><p>{lockMessage}</p></div> : null}
      {!locked ? (
        <div className="mode-grid" aria-label="Alege modul de invatare">
          <LearningModeCard
            href={`/materii/${subject.id}/interactiv`}
            mode="interactive"
            eyebrow="Raspuns imediat"
            title="Interactiv"
            description="Raspunzi pe rand si vezi corect."
            variant="compact"
            primary
          />
          <LearningModeCard
            href={`/materii/${subject.id}/studiu`}
            mode="study"
            eyebrow="Parcurgere"
            title="Studiu"
            description="Vezi intrebarile in ritmul tau."
            variant="compact"
          />
          <LearningModeCard
            href={`/materii/${subject.id}/test`}
            mode="test"
            eyebrow="Simulare"
            title="Test"
            description="Lucrezi un test si iti vezi rezultatul."
            variant="compact"
          />
        </div>
      ) : (
        <div className="mode-lock-actions">
          <p>Modurile de invatare se deschid dupa activare.</p>
          <PendingNavigationLink className="btn-link" href={lockHref} pendingLabel="Se deschid planurile...">
            Alege un plan
          </PendingNavigationLink>
        </div>
      )}
      {locked && showWelcomePremium ? (
        <WelcomePremiumInlineCard returnTo={welcomeReturnTo} />
      ) : null}
    </section>
  );
}
