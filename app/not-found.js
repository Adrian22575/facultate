import Link from "next/link";

export default function NotFound() {
  return (
    <main className="app-shell">
      <section className="app-header">
        <span className="app-kicker">404</span>
        <h1 className="page-title">Pagina nu a fost găsită</h1>
        <p className="app-subtitle">
          Ruta cerută nu există sau materia nu a putut fi identificată.
        </p>
      </section>

      <section className="surface">
        <div className="center-actions">
          <Link className="btn-back" href="/">
            Înapoi la meniu
          </Link>
          <Link className="btn-link secondary" href="/materii">
            Vezi materiile
          </Link>
        </div>
      </section>
    </main>
  );
}
