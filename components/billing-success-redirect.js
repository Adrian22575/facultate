"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { ActionLink } from "./ui/action";
import styles from "./billing-success-redirect.module.css";

const REDIRECT_SECONDS = 5;

function joinClassNames(...values) {
  return values.filter(Boolean).join(" ");
}

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
      title: "Verificam plata",
      summary: "Nu am putut confirma imediat actualizarea, dar plata nu trebuie repetata.",
      badgeClass: "is-warning"
    };
  }

  if (status === "invalid") {
    return {
      visualLabel: "Neverificat",
      title: "Verificare necesara",
      summary: "Linkul nu contine o sesiune valida pentru contul conectat.",
      badgeClass: "is-warning"
    };
  }

  return {
    visualLabel: "In curs",
      title: "Plata este in curs",
      summary: "Asteptam confirmarea finala si te trimitem apoi in sectiunea potrivita.",
    badgeClass: "is-muted"
  };
}

export function BillingSuccessRedirect({ href, status = "pending", detail }) {
  const router = useRouter();
  const [secondsLeft, setSecondsLeft] = useState(REDIRECT_SECONDS);
  const statusContent = useMemo(() => getStatusContent(status), [status]);
  const progressPercent = ((REDIRECT_SECONDS - secondsLeft) / REDIRECT_SECONDS) * 100;
  const paymentChip = status === "applied" ? "Plata confirmata" : "Plata in verificare";
  const accountChip = status === "applied" ? "Cont actualizat" : "Cont neschimbat";

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
    <div className={styles["billing-success-hero"]}>
      <div className={styles["billing-success-visual-shell"]}>
        <div className={joinClassNames(styles["billing-success-visual"], styles[statusContent.badgeClass])}>
          <div className={joinClassNames(styles["billing-success-orbit"], styles["is-one"])} />
          <div className={joinClassNames(styles["billing-success-orbit"], styles["is-two"])} />
          <div className={styles["billing-success-glow"]} />

          <div className={joinClassNames(styles["billing-success-core"], styles[statusContent.badgeClass])}>
            <div className={styles["billing-success-core-ring"]} />
            <div className={styles["billing-success-core-mark"]} aria-hidden="true">
              <svg viewBox="0 0 24 24" className={styles["billing-success-check"]}>
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

          <div className={joinClassNames(styles["billing-success-chip"], styles["is-top-left"])}>{paymentChip}</div>
          <div className={joinClassNames(styles["billing-success-chip"], styles["is-top-right"])}>{accountChip}</div>
          <div className={joinClassNames(styles["billing-success-chip"], styles["is-bottom"], styles[statusContent.badgeClass])}>
            {statusContent.visualLabel}
          </div>
        </div>
      </div>

      <div className={styles["billing-success-content"]}>
        <span className={joinClassNames("app-kicker", styles["billing-success-kicker"])}>Confirmare plata</span>
        <h2 className={styles["billing-success-title"]}>{statusContent.title}</h2>
        <p className={styles["billing-success-copy"]}>{statusContent.summary}</p>

        <div className={joinClassNames(styles["billing-success-banner"], styles[statusContent.badgeClass])}>{detail}</div>

        <div className={styles["billing-success-progress-card"]}>
          <div className={styles["billing-success-meta"]}>
            <span>Te trimitem automat in cont</span>
            <strong>{`${secondsLeft}s`}</strong>
          </div>
          <div className={styles["billing-success-progress-track"]} aria-hidden="true">
            <div
              className={joinClassNames(styles["billing-success-progress-fill"], styles[statusContent.badgeClass])}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <div className={styles["billing-success-actions"]}>
          <ActionLink variant="secondary" className={styles["billing-success-primary"]} href={href}>
            Mergi acum
          </ActionLink>
        </div>
      </div>
    </div>
  );
}
