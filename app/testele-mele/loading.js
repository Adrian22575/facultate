import { LoaderCircle } from "lucide-react";

export default function TesteleMeleLoading() {
  return (
    <main className="app-shell route-loading-shell" aria-busy="true" aria-live="polite">
      <section className="surface route-loading-card">
        <div className="route-loading-mark" aria-hidden="true">
          <LoaderCircle className="ui-loading-spinner" size={28} strokeWidth={2.2} />
        </div>
        <div>
          <span className="route-loading-kicker">Se incarca</span>
          <h1>Pregatim testele.</h1>
          <p>Adunam lista testelor tale si revenim imediat.</p>
        </div>
      </section>
    </main>
  );
}
