import Link from "next/link";
import { redirect } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { PendingNavigationLink } from "@/components/pending-navigation-link";
import {
  getAcademicCommunityLabel,
  getAcademicContext,
  getOnboardingHref,
  isAcademicContextComplete
} from "@/lib/academic/server";
import { isDemoUser } from "@/lib/demo-user";
import { getPrivateGeneratedTests } from "@/lib/private-tests";
import { getOptionalUser } from "@/lib/supabase/guards";

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

  const academicContext = !demoMode ? await getAcademicContext(user.id) : null;

  if (!demoMode && !isAcademicContextComplete(academicContext)) {
    redirect(getOnboardingHref("/testele-mele"));
  }

  let tests = { active: [], drafts: [], communityActive: [] };
  let setupWarning = null;

  if (!demoMode) {
    try {
      tests = await getPrivateGeneratedTests(user.id);
    } catch {
      setupWarning = "Testele nu au putut fi incarcate momentan.";
    }
  }

  const communityLabel = academicContext ? getAcademicCommunityLabel(academicContext) : null;

  return (
    <main className="app-shell">
      <AppHeader
        action={
          <Link className="btn-back" href="/materiale">
            Inapoi la workspace
          </Link>
        }
        kicker="Teste"
        title="Testele mele"
        subtitle="Aici vezi testele active, cele in verificare si testele din comunitate."
      />

      <section className="surface">
        {communityLabel ? (
          <div className="success-state">{`Comunitate activa: ${communityLabel}`}</div>
        ) : null}
        {demoMode ? (
          <div className="error-state">
            In modul demo aceasta pagina afiseaza doar structura.
          </div>
        ) : null}
        {setupWarning ? <div className="error-state">{setupWarning}</div> : null}
      </section>

      <section className="surface">
        <div className="dashboard-header">
          <h2>Teste din comunitate</h2>
          <Link className="btn-link secondary" href="/onboarding?edit=1&source=query">
            Schimba comunitatea
          </Link>
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
          <div className="empty-state">
            {demoMode
              ? "In modul demo nu incarcam teste din comunitate."
              : "Nu exista inca teste active publicate pentru comunitatea ta."}
          </div>
        )}
      </section>

      <section className="surface">
        <div className="dashboard-header">
          <h2>Testele mele active</h2>
          <Link className="btn-link secondary" href="/materiale">
            Genereaza test nou
          </Link>
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
                    <Link className="btn-link secondary" href={`/materiale/drafts/${test.id}`}>
                      Editeaza
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            {demoMode ? "In modul demo nu incarcam teste active reale." : "Nu ai inca teste active."}
          </div>
        )}
      </section>

      <section className="surface">
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
                  <Link className="btn-link secondary" href={`/materiale/drafts/${test.id}`}>
                    Deschide
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            {demoMode ? "In modul demo nu exista teste in verificare." : "Nu exista teste in verificare."}
          </div>
        )}
      </section>
    </main>
  );
}
