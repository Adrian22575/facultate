import { moduleClassNames } from "@/lib/ui/module-class-names";
import styles from "./learning-mode-card.module.css";
import fs from "node:fs";
import path from "node:path";

import Image from "next/image";

import { PendingNavigationLink } from "@/components/pending-navigation-link";

function ModeVisual({ mode }) {
  const imageSrc = `/images/modes/${mode}.png`;
  const imagePath = path.join(process.cwd(), "public", "images", "modes", `${mode}.png`);

  if (fs.existsSync(imagePath)) {
    return (
      <div className={moduleClassNames([styles], "learning-mode-visual learning-mode-visual-image")} aria-hidden="true">
        <div className={moduleClassNames([styles], "learning-mode-image-wrap")}>
          <Image
            src={imageSrc}
            alt=""
            width={768}
            height={432}
            className={moduleClassNames([styles], "learning-mode-image")}
            sizes="(max-width: 980px) 100vw, (max-width: 1280px) 50vw, 33vw"
          />
        </div>
      </div>
    );
  }

  if (mode === "interactive") {
    return (
      <div className={moduleClassNames([styles], "learning-mode-visual")} aria-hidden="true">
        <span className={moduleClassNames([styles], "learning-mode-orb")} />
        <span className={moduleClassNames([styles], "learning-mode-line learning-mode-line-one")} />
        <span className={moduleClassNames([styles], "learning-mode-line learning-mode-line-two")} />
      </div>
    );
  }

  if (mode === "study") {
    return (
      <div className={moduleClassNames([styles], "learning-mode-visual")} aria-hidden="true">
        <span className={moduleClassNames([styles], "learning-mode-book learning-mode-book-left")} />
        <span className={moduleClassNames([styles], "learning-mode-book learning-mode-book-right")} />
        <span className={moduleClassNames([styles], "learning-mode-book-line")} />
      </div>
    );
  }

  return (
    <div className={moduleClassNames([styles], "learning-mode-visual")} aria-hidden="true">
      <span className={moduleClassNames([styles], "learning-mode-sheet")} />
      <span className={moduleClassNames([styles], "learning-mode-check learning-mode-check-one")} />
      <span className={moduleClassNames([styles], "learning-mode-check learning-mode-check-two")} />
    </div>
  );
}

export function LearningModeCard({
  href,
  mode,
  eyebrow,
  title,
  description,
  variant = "showcase",
  primary = false,
  disabled = false
}) {
  const variantClass =
    variant === "compact" ? "learning-mode-card-compact" : "learning-mode-card-showcase";
  const sharedClassName = `learning-mode-card ${variantClass} learning-mode-${mode}${primary ? " is-primary" : ""}${disabled ? " is-disabled" : ""}`;

  if (disabled) {
    return (
      <article className={moduleClassNames([styles], sharedClassName)} aria-disabled="true">
        <ModeVisual mode={mode} />
        <div className={moduleClassNames([styles], "learning-mode-copy")}>
          {eyebrow ? <span className={moduleClassNames([styles], "learning-mode-kicker")}>{eyebrow}</span> : null}
          <h3>{title}</h3>
          <div className={moduleClassNames([styles], "learning-mode-footer")}>
            <p>{description}</p>
            <span className={moduleClassNames([styles], "learning-mode-arrow")} aria-hidden="true">
              <svg viewBox="0 0 20 20" fill="none" className={moduleClassNames([styles], "learning-mode-arrow-icon")}>
                <path
                  d="M4.25 10H15.75M15.75 10L10.5 4.75M15.75 10L10.5 15.25"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </div>
        </div>
      </article>
    );
  }

  return (
    <PendingNavigationLink
      href={href}
      className={moduleClassNames([styles], sharedClassName)}
      pendingLabel="Se deschide modul..."
    >
      <ModeVisual mode={mode} />
      <div className={moduleClassNames([styles], "learning-mode-copy")}>
        {eyebrow ? <span className={moduleClassNames([styles], "learning-mode-kicker")}>{eyebrow}</span> : null}
        <h3>{title}</h3>
        <div className={moduleClassNames([styles], "learning-mode-footer")}>
          <p>{description}</p>
          <span className={moduleClassNames([styles], "learning-mode-arrow")} aria-hidden="true">
            <svg viewBox="0 0 20 20" fill="none" className={moduleClassNames([styles], "learning-mode-arrow-icon")}>
              <path
                d="M4.25 10H15.75M15.75 10L10.5 4.75M15.75 10L10.5 15.25"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </div>
      </div>
    </PendingNavigationLink>
  );
}
