import styles from "./progress-bar.module.css";

export function ProgressBar({ value = 0, className = "", fillClassName = "", ...props }) {
  const percent = Math.min(100, Math.max(0, Number(value) || 0));

  return (
    <div {...props} className={[styles.track, className].filter(Boolean).join(" ")}>
      <div
        className={[styles.fill, fillClassName].filter(Boolean).join(" ")}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
