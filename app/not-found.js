import { SearchX } from "lucide-react";

import { PendingNavigationLink } from "@/components/pending-navigation-link";

export const metadata = {
  title: "Pagina nu a fost gasita | Nota 5+",
  robots: {
    index: false,
    follow: false
  }
};

export default function NotFoundPage() {
  return (
    <main className="app-shell route-error-shell">
      <section className="surface route-error-card">
        <span className="route-error-icon" aria-hidden="true">
          <SearchX size={30} strokeWidth={2} />
        </span>
        <span className="ui-section-label">Eroare 404</span>
        <h1>Pagina aceasta nu mai este aici.</h1>
        <p>Adresa poate fi gresita sau continutul a fost mutat. Poti reveni imediat la o zona sigura.</p>
        <div className="route-error-actions">
          <PendingNavigationLink className="btn-link btn-primary" href="/" pendingLabel="Se deschide pagina principala..." pendingMode="replace">
            Mergi la pagina principala
          </PendingNavigationLink>
          <PendingNavigationLink className="btn-link secondary" href="/materiale" pendingLabel="Se deschid materialele..." pendingMode="replace">
            Deschide materialele
          </PendingNavigationLink>
        </div>
      </section>
    </main>
  );
}
