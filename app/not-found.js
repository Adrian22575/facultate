import Link from "next/link";
import { SearchX } from "lucide-react";

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
          <Link className="btn-link btn-primary" href="/">
            Mergi la pagina principala
          </Link>
          <Link className="btn-link secondary" href="/materiale">
            Deschide Workspace
          </Link>
        </div>
      </section>
    </main>
  );
}
