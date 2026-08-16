import styles from "./dialog-shell.module.css";

function joinClassNames(...values) {
  return values.filter(Boolean).join(" ");
}

export function DialogShell({
  dialogRef,
  closeRef,
  titleId,
  title,
  description,
  onClose,
  closeDisabled = false,
  closeLabel = "Inchide",
  closeContent,
  panelClassName = "",
  bodyClassName = "",
  actions,
  children,
  onBackdropClick
}) {
  return (
    <div className={styles.backdrop} role="presentation" onClick={onBackdropClick}>
      <div
        ref={dialogRef}
        className={joinClassNames(styles.panel, panelClassName)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className={styles.header}>
          <div>
            <strong id={titleId}>{title}</strong>
            {description ? <p>{description}</p> : null}
          </div>
          <button
            ref={closeRef}
            className={styles.close}
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            disabled={closeDisabled}
          >
            {closeContent || closeLabel}
          </button>
        </div>
        <div className={joinClassNames(styles.body, bodyClassName)}>{children}</div>
        {actions ? <div className={styles.actions}>{actions}</div> : null}
      </div>
    </div>
  );
}
