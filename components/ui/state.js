import { SectionLabel } from "./section-label";
import { LoadingSpinner } from "@/components/loading-spinner";
import { SurfaceCard } from "@/components/ui/surface-card";

import styles from "./state.module.css";

const EMPTY_VARIANTS = {
  compact: styles.emptyCompact,
  section: styles.emptySection
};

const FEEDBACK_TONES = {
  neutral: styles.feedbackNeutral,
  warning: styles.feedbackWarning
};

function joinClassNames(...values) {
  return values.filter(Boolean).join(" ");
}

export function EmptyState({
  as: Component = "div",
  variant = "compact",
  title = "",
  description = "",
  actions = null,
  className = "",
  ...props
}) {
  return (
    <Component
      {...props}
      className={joinClassNames(
        styles.empty,
        EMPTY_VARIANTS[variant] || EMPTY_VARIANTS.compact,
        className
      )}
    >
      {title ? <strong className={styles.emptyTitle}>{title}</strong> : null}
      {description ? <p className={styles.emptyDescription}>{description}</p> : null}
      {actions ? <div className={styles.emptyActions}>{actions}</div> : null}
    </Component>
  );
}

export function LoadingState({
  title = "Pregatim pagina.",
  description = "Mai dureaza doar un moment.",
  label = "Se incarca",
  className = "",
  ...props
}) {
  return (
    <main
      {...props}
      className={joinClassNames("app-shell", styles.pageState, className)}
      aria-busy="true"
      aria-live="polite"
    >
      <SurfaceCard className={styles.loadingCard}>
        <LoadingSpinner size={58} />
        <div>
          <span className={styles.loadingKicker}>{label}</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
      </SurfaceCard>
    </main>
  );
}

export function FeedbackState({
  tone = "neutral",
  icon = null,
  eyebrow,
  title,
  description,
  actions = null,
  role,
  "aria-live": ariaLive,
  className = "",
  ...props
}) {
  return (
    <main {...props} className={joinClassNames("app-shell", styles.pageState, className)}>
      <SurfaceCard
        className={joinClassNames(
          styles.feedbackCard,
          FEEDBACK_TONES[tone] || FEEDBACK_TONES.neutral
        )}
        role={role}
        aria-live={ariaLive}
      >
        {icon ? <span className={styles.feedbackIcon} aria-hidden="true">{icon}</span> : null}
        {eyebrow ? <SectionLabel>{eyebrow}</SectionLabel> : null}
        <h1>{title}</h1>
        <p>{description}</p>
        {actions ? <div className={styles.feedbackActions}>{actions}</div> : null}
      </SurfaceCard>
    </main>
  );
}
