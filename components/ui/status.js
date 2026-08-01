import styles from "./status.module.css";

const PILL_TONES = {
  neutral: styles.neutral,
  info: styles.info,
  success: styles.success,
  warning: styles.warning,
  danger: styles.danger
};

const FEEDBACK_TONES = {
  error: styles.feedbackError,
  success: styles.feedbackSuccess
};

function joinClassNames(...values) {
  return values.filter(Boolean).join(" ");
}

export function StatusPill({ tone = "neutral", className = "", ...props }) {
  return (
    <span
      {...props}
      className={joinClassNames(styles.pill, PILL_TONES[tone] || PILL_TONES.neutral, className)}
    />
  );
}

export function InlineFeedback({
  tone = "error",
  role,
  "aria-live": ariaLive,
  className = "",
  ...props
}) {
  const resolvedRole = role || (tone === "success" ? "status" : "alert");

  return (
    <div
      {...props}
      role={resolvedRole}
      aria-live={ariaLive}
      className={joinClassNames(
        styles.feedback,
        FEEDBACK_TONES[tone] || FEEDBACK_TONES.error,
        className
      )}
    />
  );
}
