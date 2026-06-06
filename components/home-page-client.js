"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { getLastSession } from "@/lib/session-storage";
import { VersionBadge } from "@/components/version-badge";

export function HomePageClient() {
  const [session, setSession] = useState(null);

  useEffect(() => {
    setSession(getLastSession());
  }, []);

  return (
    <>
      <section className="home-stack" aria-label="Meniu principal">
        {session?.url ? (
          <div className="surface quick-continue">
            <span className="app-kicker">Continuă rapid</span>
            <h2>{`Continuă: ${session.subjectTitle}`}</h2>
            <p className="page-copy">{`Ultimul mod folosit: ${session.mode}`}</p>
            <Link className="test-link primary" href={session.url}>
              <strong>{`Continuă ${session.mode}`}</strong>
              <span>{`Revino la ${session.subjectTitle}.`}</span>
            </Link>
          </div>
        ) : null}

        <div className="surface surface-main">
          <h2>Începe sesiunea</h2>
          <p className="page-copy">
            Intră direct în modul potrivit pentru ritmul tău de învățare.
          </p>

          <ul className="action-list action-list-spaced">
            <li>
              <Link className="test-link primary" href="/materii">
                <strong>Teste pe materii</strong>
                <span>Alege materia, apoi intră în Interactiv, Studiu sau Test.</span>
              </Link>
            </li>
            <li>
              <Link className="test-link" href="/licenta-exam">
                <strong>Simulare examen licență</strong>
                <span>60 de întrebări aleatorii din toate materiile, cu timer.</span>
              </Link>
            </li>
          </ul>
        </div>

        <aside className="surface surface-guide" aria-label="Moduri disponibile">
          <h2>Moduri disponibile</h2>
          <div className="study-flow">
            <div className="study-flow-item">
              <span>1</span>
              <div>
                <strong>Interactiv</strong>
                <p>Primești feedback imediat după răspuns.</p>
              </div>
            </div>
            <div className="study-flow-item">
              <span>2</span>
              <div>
                <strong>Studiu</strong>
                <p>Vezi toate grilele cu răspunsul corect marcat.</p>
              </div>
            </div>
            <div className="study-flow-item">
              <span>3</span>
              <div>
                <strong>Test</strong>
                <p>Lucrezi contra unui set ales și vezi scorul final.</p>
              </div>
            </div>
          </div>
        </aside>
      </section>

      <VersionBadge />
    </>
  );
}
