export default function TesteleMeleLoading() {
  return (
    <main className="app-shell route-loading-shell" aria-busy="true" aria-live="polite">
      <section className="surface route-loading-card">
        <div className="route-loading-mark" aria-hidden="true">
          <svg className="ui-loading-spinner" width="28" height="28" viewBox="0 0 24 24">
            <circle className="ui-loading-spinner-track" cx="12" cy="12" r="9" />
            <path className="ui-loading-spinner-ring" d="M21 12a9 9 0 0 1-9 9" />
          </svg>
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
