import Link from "next/link";

import { BILLING_PLAN_LIST } from "@/lib/stripe/plans";

export const metadata = {
  title: "Preturi | Nota 5+",
  description: "Vezi planurile de acces si pachetele de incarcari disponibile in Nota 5+."
};

function formatPrice(plan) {
  return new Intl.NumberFormat("ro-RO", {
    style: "currency",
    currency: plan.currency.toUpperCase(),
    maximumFractionDigits: 0
  }).format(plan.amount / 100);
}

function PricingGroup({ title, description, plans, view }) {
  return (
    <section className="public-pricing-group">
      <div className="public-pricing-heading">
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <div className="public-pricing-grid">
        {plans.map((plan) => (
          <article className="public-pricing-card" key={plan.code}>
            <div>
              <h3>{plan.name}</h3>
              <p>{plan.description}</p>
            </div>
            <strong className="public-pricing-price">{formatPrice(plan)}</strong>
            <Link
              className="nota5plus-btn nota5plus-btn-primary"
              href={`/auth/login?next=${encodeURIComponent(`/cont?section=${view}&plan=${plan.code}#planuri`)}`}
            >
              Continua
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}

export default function PricingPage() {
  const accessPlans = BILLING_PLAN_LIST.filter((plan) => plan.family === "premium");
  const uploadPlans = BILLING_PLAN_LIST.filter((plan) => plan.family === "ai_credits");

  return (
    <main className="nota5plus-page public-pricing-page">
      <div className="nota5plus-container">
        <nav className="nota5plus-nav">
          <Link className="nota5plus-brand" href="/">
            <span className="nota5plus-brand-mark">5+</span>
            <span>Nota 5+</span>
          </Link>
          <Link className="nota5plus-nav-link" href="/auth/login">
            Intra in cont
          </Link>
        </nav>

        <header className="public-pricing-hero">
          <span>Plati unice, fara reinnoire automata</span>
          <h1>Alege doar ce iti trebuie pentru examen.</h1>
          <p>Accesul la modurile de invatare si incarcarile de materiale se cumpara separat.</p>
        </header>

        <PricingGroup
          title="Acces la invatare"
          description="Pentru modurile Studiu, Interactiv si Test din materiile comunitatii tale."
          plans={accessPlans}
          view="plans"
        />
        <PricingGroup
          title="Incarcari de materiale"
          description="Pentru transformarea propriilor cursuri in capitole, flashcarduri, teste si plan de invatare."
          plans={uploadPlans}
          view="credits"
        />

        <p className="public-pricing-note">
          Preturile sunt afisate in lei. Plata este procesata securizat, iar accesul se activeaza in cont dupa confirmare.
        </p>

        <footer className="nota5plus-legal-footer">
          <span>Nota 5+</span>
          <nav aria-label="Informatii juridice">
            <Link href="/despre">Despre</Link>
            <Link href="/confidentialitate">Confidentialitate</Link>
            <Link href="/termeni">Termeni</Link>
          </nav>
        </footer>
      </div>
    </main>
  );
}
