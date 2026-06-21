import Link from "next/link";

import { getLegalContactHref, legalDetails } from "@/lib/legal";

export function PublicLegalPage({ eyebrow, title, intro, children }) {
  const contactHref = getLegalContactHref();

  return (
    <main className="legal-page-shell">
      <header className="legal-page-nav">
        <Link className="brand" href="/">
          <span className="brand-mark">5+</span>
          <span>Nota 5+</span>
        </Link>
        <nav aria-label="Navigare documente juridice">
          <Link href="/confidentialitate">Confidentialitate</Link>
          <Link href="/termeni">Termeni</Link>
          <Link href="/">Inapoi la site</Link>
        </nav>
      </header>

      <article className="legal-document">
        <header className="legal-document-head">
          <span className="ui-section-label">{eyebrow}</span>
          <h1>{title}</h1>
          <p>{intro}</p>
          <small>Ultima actualizare: 19 iunie 2026</small>
        </header>

        <section className="legal-operator-card" aria-labelledby="legal-operator-title">
          <h2 id="legal-operator-title">Datele operatorului</h2>
          <dl>
            <div><dt>Denumire</dt><dd>{legalDetails.operatorName}</dd></div>
            <div><dt>Sediu</dt><dd>{legalDetails.operatorAddress}</dd></div>
            <div><dt>Identificare</dt><dd>{legalDetails.registrationId}</dd></div>
            <div>
              <dt>Contact</dt>
              <dd>{contactHref ? <a href={contactHref}>{legalDetails.contactEmail}</a> : legalDetails.contactEmail}</dd>
            </div>
          </dl>
        </section>

        <div className="legal-document-content">{children}</div>
      </article>

      <footer className="legal-page-footer">
        <span>Nota 5+</span>
        <div>
          <Link href="/despre">Despre</Link>
          <Link href="/confidentialitate">Confidentialitate</Link>
          <Link href="/termeni">Termeni</Link>
        </div>
      </footer>
    </main>
  );
}
