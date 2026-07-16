import { LoaderCircle } from "lucide-react";

export function RouteLoadingState({
  title = "Pregatim pagina.",
  description = "Mai dureaza doar un moment."
}) {
  return (
    <main className="app-shell route-loading-shell" aria-busy="true" aria-live="polite">
      <section className="surface route-loading-card">
        <div className="route-loading-mark" aria-hidden="true">
          <LoaderCircle className="ui-loading-spinner" size={28} strokeWidth={2.2} />
        </div>
        <div>
          <span className="route-loading-kicker">Se incarca</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
      </section>
    </main>
  );
}
