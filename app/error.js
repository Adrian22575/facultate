"use client";

import { CircleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

export default function GlobalRouteError({ error, reset }) {
  useEffect(() => {
    console.error("route_render_failed", error);
  }, [error]);

  return (
    <main className="app-shell route-error-shell">
      <section className="surface route-error-card" role="alert">
        <span className="route-error-icon is-warning" aria-hidden="true">
          <CircleAlert size={30} strokeWidth={2} />
        </span>
        <span className="ui-section-label">Pagina nu s-a incarcat</span>
        <h1>A aparut o problema temporara.</h1>
        <p>Progresul salvat nu este afectat. Incearca din nou sau revino la pagina principala.</p>
        <div className="route-error-actions">
          <button type="button" onClick={reset}>
            Incearca din nou
          </button>
          <Link className="btn-link secondary" href="/">
            Mergi la pagina principala
          </Link>
        </div>
      </section>
    </main>
  );
}
