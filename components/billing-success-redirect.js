"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const REDIRECT_SECONDS = 5;

function getStatusContent(status) {
  if (status === "applied") {
    return {
      visualLabel: "Confirmat",
      title: "Totul este pregatit",
      summary: "Planul sau pachetul tau este deja aplicat si poti continua imediat.",
      badgeClass: "is-good"
    };
  }

  if (status === "warning") {
    return {
      visualLabel: "Verificare",
      title: "Plata este reusita",
      summary: "Mai verificam sincronizarea, dar te poti intoarce imediat in cont.",
      badgeClass: "is-warning"
    };
  }

  return {
    visualLabel: "In curs",
    title: "Plata este confirmata",
    summary: "Actualizarea este pe drum si te trimitem imediat in sectiunea potrivita.",
    badgeClass: "is-muted"
  };
}

export function BillingSuccessRedirect({ href, status = "pending", detail }) {
  const router = useRouter();
  const [secondsLeft, setSecondsLeft] = useState(REDIRECT_SECONDS);
  const statusContent = useMemo(() => getStatusContent(status), [status]);
  const progressPercent = ((REDIRECT_SECONDS - secondsLeft) / REDIRECT_SECONDS) * 100;

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          window.clearInterval(intervalId);
          router.replace(href);
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [href, router]);

  return (
    <div className="billing-success-hero">
      <div className="billing-success-visual-shell">
        <div className={`billing-success-visual ${statusContent.badgeClass}`}>
          <div className="billing-success-orbit is-one" />
          <div className="billing-success-orbit is-two" />
          <div className="billing-success-glow" />

          <div className={`billing-success-core ${statusContent.badgeClass}`}>
            <div className="billing-success-core-ring" />
            <div className="billing-success-core-mark" aria-hidden="true">
              <svg viewBox="0 0 24 24" className="billing-success-check">
                <path
                  d="M5.5 12.5 9.5 16.5 18.5 7.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>

          <div className="billing-success-chip is-top-left">Plata confirmata</div>
          <div className="billing-success-chip is-top-right">Cont actualizat</div>
          <div className={`billing-success-chip is-bottom ${statusContent.badgeClass}`}>
            {statusContent.visualLabel}
          </div>
        </div>
      </div>

      <div className="billing-success-content">
        <span className="app-kicker billing-success-kicker">Confirmare plata</span>
        <h2 className="billing-success-title">{statusContent.title}</h2>
        <p className="billing-success-copy">{statusContent.summary}</p>

        <div className={`billing-success-banner ${statusContent.badgeClass}`}>{detail}</div>

        <div className="billing-success-progress-card">
          <div className="billing-success-meta">
            <span>Te trimitem automat in cont</span>
            <strong>{`${secondsLeft}s`}</strong>
          </div>
          <div className="billing-success-progress-track" aria-hidden="true">
            <div
              className={`billing-success-progress-fill ${statusContent.badgeClass}`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <div className="billing-success-actions">
          <Link className="btn-back billing-success-primary" href={href}>
            Mergi acum
          </Link>
        </div>
      </div>
    </div>
  );
}
