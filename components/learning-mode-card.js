import fs from "node:fs";
import path from "node:path";

import Image from "next/image";
import Link from "next/link";

function ModeVisual({ mode }) {
  const imageSrc = `/images/modes/${mode}.png`;
  const imagePath = path.join(process.cwd(), "public", "images", "modes", `${mode}.png`);

  if (fs.existsSync(imagePath)) {
    return (
      <div className="learning-mode-visual learning-mode-visual-image" aria-hidden="true">
        <div className="learning-mode-image-wrap">
          <Image
            src={imageSrc}
            alt=""
            width={768}
            height={432}
            className="learning-mode-image"
            sizes="(max-width: 980px) 100vw, (max-width: 1280px) 50vw, 33vw"
          />
        </div>
      </div>
    );
  }

  if (mode === "interactive") {
    return (
      <div className="learning-mode-visual" aria-hidden="true">
        <span className="learning-mode-orb" />
        <span className="learning-mode-line learning-mode-line-one" />
        <span className="learning-mode-line learning-mode-line-two" />
      </div>
    );
  }

  if (mode === "study") {
    return (
      <div className="learning-mode-visual" aria-hidden="true">
        <span className="learning-mode-book learning-mode-book-left" />
        <span className="learning-mode-book learning-mode-book-right" />
        <span className="learning-mode-book-line" />
      </div>
    );
  }

  return (
    <div className="learning-mode-visual" aria-hidden="true">
      <span className="learning-mode-sheet" />
      <span className="learning-mode-check learning-mode-check-one" />
      <span className="learning-mode-check learning-mode-check-two" />
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
      <article className={sharedClassName} aria-disabled="true">
        <ModeVisual mode={mode} />
        <div className="learning-mode-copy">
          {eyebrow ? <span className="learning-mode-kicker">{eyebrow}</span> : null}
          <h3>{title}</h3>
          <div className="learning-mode-footer">
            <p>{description}</p>
            <span className="learning-mode-arrow" aria-hidden="true">
              <svg viewBox="0 0 20 20" fill="none" className="learning-mode-arrow-icon">
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
    <Link href={href} className={sharedClassName}>
      <ModeVisual mode={mode} />
      <div className="learning-mode-copy">
        {eyebrow ? <span className="learning-mode-kicker">{eyebrow}</span> : null}
        <h3>{title}</h3>
        <div className="learning-mode-footer">
          <p>{description}</p>
          <span className="learning-mode-arrow" aria-hidden="true">
            <svg viewBox="0 0 20 20" fill="none" className="learning-mode-arrow-icon">
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
    </Link>
  );
}
