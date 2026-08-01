"use client";

import { CircleAlert } from "lucide-react";
import { useEffect } from "react";

import { ActionLink, Button } from "@/components/ui/action";

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
          <Button className="route-error-action" onClick={reset}>
            Incearca din nou
          </Button>
          <ActionLink className="route-error-action" href="/" variant="secondary">
            Mergi la pagina principala
          </ActionLink>
        </div>
      </section>
    </main>
  );
}
