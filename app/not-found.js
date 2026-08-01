import { SearchX } from "lucide-react";

import { PendingNavigationLink } from "@/components/pending-navigation-link";
import { ActionLink } from "@/components/ui/action";

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
          <ActionLink
            as={PendingNavigationLink}
            className="route-error-action"
            href="/"
            pendingLabel="Se deschide pagina principala..."
            pendingMode="replace"
          >
            Mergi la pagina principala
          </ActionLink>
          <ActionLink
            as={PendingNavigationLink}
            className="route-error-action"
            href="/materiale"
            pendingLabel="Se deschid materialele..."
            pendingMode="replace"
            variant="secondary"
          >
            Deschide materialele
          </ActionLink>
        </div>
      </section>
    </main>
  );
}
