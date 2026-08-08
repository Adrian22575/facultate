import Link from "next/link";

import styles from "./page.module.css";

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
    <section className={styles.group}>
      <div className={styles.heading}>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <div className={styles.grid}>
        {plans.map((plan) => (
          <article className={styles.card} key={plan.code}>
            <div>
              <h3>{plan.name}</h3>
              <p>{plan.description}</p>
            </div>
            <strong className={styles.price}>{formatPrice(plan)}</strong>
            <Link
              className="nota5plus-btn nota5plus-btn-primary"
              href={`/auth/exit-demo?target=login&next=${encodeURIComponent(`/cont?section=${view}&plan=${plan.code}#planuri`)}`}
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
    <main className={`nota5plus-page ${styles.page}`}>
      <div className="nota5plus-container">
        <nav className="nota5plus-nav">
          <Link className="nota5plus-brand" href="/">
            <span className="nota5plus-brand-mark">5+</span>
            <span>Nota 5+</span>
          </Link>
          <Link className="nota5plus-nav-link" href="/auth/exit-demo?target=login">
            Intra in cont
          </Link>
        </nav>

        <header className={styles.hero}>
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

        <p className={styles.note}>
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
