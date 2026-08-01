import { redirect } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { PendingNavigationLink } from "@/components/pending-navigation-link";
import { EmptyState } from "@/components/ui/state";
import { InlineFeedback } from "@/components/ui/status";
import { SurfaceCard } from "@/components/ui/surface-card";
import {
  getAcademicCommunityLabel,
  getAcademicContext,
  getOnboardingHref,
  isAcademicContextComplete
} from "@/lib/academic/server";
import { isDemoUser } from "@/lib/demo-user";
import { getPrivateGeneratedTests } from "@/lib/private-tests";
import { getOptionalUser } from "@/lib/supabase/guards";

import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Testele mele | Nota 5+"
};

function TestOpenLink({ href, children = "Rezolva" }) {
  return (
    <PendingNavigationLink
      className="btn-back"
      href={href}
      pendingLabel="Se deschide testul..."
      pendingMode="replace"
    >
      {children}
    </PendingNavigationLink>
  );
}

export default async function MyTestsPage() {
  const user = await getOptionalUser();
  const demoMode = isDemoUser(user);

  if (!user) {
    redirect("/auth/login?next=/testele-mele");
  }

  const academicContextPromise = !demoMode
    ? getAcademicContext(user.id)
    : Promise.resolve(null);
  const testsPromise = !demoMode
    ? getPrivateGeneratedTests(user.id, { academicContextPromise })
        .then((value) => ({ value, error: null }))
        .catch((error) => ({ value: null, error }))
    : Promise.resolve({ value: null, error: null });
  const [academicContext, testsResult] = await Promise.all([
    academicContextPromise,
    testsPromise
  ]);

  if (!demoMode && !isAcademicContextComplete(academicContext)) {
    redirect(getOnboardingHref("/testele-mele"));
  }

  let tests = { active: [], drafts: [], communityActive: [] };
  let setupWarning = null;

  if (!demoMode) {
    if (testsResult.error) {
      setupWarning = "Testele nu au putut fi incarcate momentan.";
    } else if (testsResult.value) {
      tests = testsResult.value;
    }
  }

  const communityLabel = academicContext ? getAcademicCommunityLabel(academicContext) : null;

  return (
    <main className="app-shell">
      <AppHeader
        action={
          <PendingNavigationLink className="btn-back" href="/materiale" pendingLabel="Se revine la materiale..." pendingMode="replace">
            Inapoi la materiale
          </PendingNavigationLink>
        }
        kicker="Teste"
        title="Testele mele"
        subtitle="Aici vezi testele active, cele in verificare si testele din comunitate."
      />

      <SurfaceCard className={styles.section}>
        {communityLabel ? (
          <InlineFeedback className={styles.successFeedback} tone="success" role="status">
            {`Comunitate activa: ${communityLabel}`}
          </InlineFeedback>
        ) : null}
        {demoMode ? (
          <InlineFeedback tone="error" role="alert">
            In modul demo aceasta pagina afiseaza doar structura.
          </InlineFeedback>
        ) : null}
        {setupWarning ? <InlineFeedback tone="error" role="alert">{setupWarning}</InlineFeedback> : null}
      </SurfaceCard>

      <SurfaceCard className={styles.section}>
        <div className="dashboard-header">
          <h2>Teste din comunitate</h2>
          <PendingNavigationLink className="btn-link secondary" href="/onboarding?edit=1&source=query" pendingLabel="Se deschide comunitatea..." pendingMode="replace">
            Schimba comunitatea
          </PendingNavigationLink>
        </div>
        {tests.communityActive?.length ? (
          <div className="draft-list">
            {tests.communityActive.map((test) => (
              <article key={test.id} className="draft-card">
                <div className="draft-card-head">
                  <div>
                    <strong>{test.title}</strong>
                    <p className="choice-row-meta">{`${test.total_questions} intrebari`}</p>
                  </div>
                  <TestOpenLink href={`/testele-mele/${test.id}`} />
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            description={demoMode
              ? "In modul demo nu incarcam teste din comunitate."
              : "Nu exista inca teste active publicate pentru comunitatea ta."}
          />
        )}
      </SurfaceCard>

      <SurfaceCard className={styles.section}>
        <div className="dashboard-header">
          <h2>Testele mele active</h2>
          <PendingNavigationLink className="btn-link secondary" href="/materiale" pendingLabel="Se deschid materialele..." pendingMode="replace">
            Genereaza test nou
          </PendingNavigationLink>
        </div>
        {tests.active.length ? (
          <div className="draft-list">
            {tests.active.map((test) => (
              <article key={test.id} className="draft-card">
                <div className="draft-card-head">
                  <div>
                    <strong>{test.title}</strong>
                    <p className="choice-row-meta">{`${test.total_questions} intrebari - activ`}</p>
                  </div>
                  <div className="inline-actions">
                    <TestOpenLink href={`/testele-mele/${test.id}`} />
                    <PendingNavigationLink className="btn-link secondary" href={`/materiale/drafts/${test.id}`} pendingLabel="Se deschide editorul..." pendingMode="replace">
                      Editeaza
                    </PendingNavigationLink>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            description={demoMode ? "In modul demo nu incarcam teste active reale." : "Nu ai inca teste active."}
          />
        )}
      </SurfaceCard>

      <SurfaceCard className={styles.section}>
        <h2>Teste in verificare</h2>
        {tests.drafts.length ? (
          <div className="draft-list">
            {tests.drafts.map((test) => (
              <article key={test.id} className="draft-card">
                <div className="draft-card-head">
                  <div>
                    <strong>{test.title}</strong>
                    <p className="choice-row-meta">{`${test.total_questions} intrebari - in verificare`}</p>
                  </div>
                  <PendingNavigationLink className="btn-link secondary" href={`/materiale/drafts/${test.id}`} pendingLabel="Se deschide editorul..." pendingMode="replace">
                    Deschide
                  </PendingNavigationLink>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            description={demoMode ? "In modul demo nu exista teste in verificare." : "Nu exista teste in verificare."}
          />
        )}
      </SurfaceCard>
    </main>
  );
}
