import { LoadingSpinner } from "@/components/loading-spinner";

export function RouteLoadingState({
  title = "Pregatim pagina.",
  description = "Mai dureaza doar un moment."
}) {
  return (
    <main className="app-shell route-loading-shell" aria-busy="true" aria-live="polite">
      <section className="surface route-loading-card">
        <LoadingSpinner size={58} />
        <div>
          <span className="route-loading-kicker">Se incarca</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
      </section>
    </main>
  );
}
