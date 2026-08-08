import Link from "next/link";

import { getLegalContactHref, legalDetails } from "@/lib/legal";
import styles from "@/components/public-legal-page.module.css";

export function PublicLegalPage({ eyebrow, title, intro, children }) {
  const contactHref = getLegalContactHref();

  return (
    <main className={styles.pageShell}>
      <header className={styles.pageNav}>
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

      <article className={styles.document}>
        <header className={styles.documentHead}>
          <span className="ui-section-label">{eyebrow}</span>
          <h1>{title}</h1>
          <p>{intro}</p>
          <small>Ultima actualizare: 19 iunie 2026</small>
        </header>

        <section className={styles.operatorCard} aria-labelledby="legal-operator-title">
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

        <div className={styles.documentContent}>{children}</div>
      </article>

      <footer className={styles.pageFooter}>
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
