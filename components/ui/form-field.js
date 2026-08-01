import { forwardRef } from "react";

import styles from "./form-field.module.css";

function joinClassNames(...values) {
  return values.filter(Boolean).join(" ");
}

function describedBy({ id, hint, error, describedBy }) {
  return [describedBy, hint && `${id}-hint`, error && `${id}-error`]
    .filter(Boolean)
    .join(" ") || undefined;
}

export const TextField = forwardRef(function TextField(
  {
    id,
    label,
    hint = "",
    error = "",
    fieldClassName = "",
    controlClassName = "",
    "aria-describedby": ariaDescribedBy,
    ...props
  },
  ref
) {
  return (
    <label className={joinClassNames(styles.field, fieldClassName)} htmlFor={id}>
      <span className={styles.label}>{label}</span>
      <input
        {...props}
        ref={ref}
        id={id}
        className={joinClassNames(styles.control, controlClassName)}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={describedBy({ id, hint, error, describedBy: ariaDescribedBy })}
      />
      {hint ? (
        <small className={styles.hint} id={`${id}-hint`}>
          {hint}
        </small>
      ) : null}
      {error ? (
        <small className={styles.error} id={`${id}-error`} role="alert">
          {error}
        </small>
      ) : null}
    </label>
  );
});

export const SelectField = forwardRef(function SelectField(
  {
    id,
    label,
    hint = "",
    error = "",
    fieldClassName = "",
    controlClassName = "",
    children,
    "aria-describedby": ariaDescribedBy,
    ...props
  },
  ref
) {
  return (
    <label className={joinClassNames(styles.field, fieldClassName)} htmlFor={id}>
      <span className={styles.label}>{label}</span>
      <select
        {...props}
        ref={ref}
        id={id}
        className={joinClassNames(styles.control, styles.select, controlClassName)}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={describedBy({ id, hint, error, describedBy: ariaDescribedBy })}
      >
        {children}
      </select>
      {hint ? (
        <small className={styles.hint} id={`${id}-hint`}>
          {hint}
        </small>
      ) : null}
      {error ? (
        <small className={styles.error} id={`${id}-error`} role="alert">
          {error}
        </small>
      ) : null}
    </label>
  );
});

export const TextareaField = forwardRef(function TextareaField(
  {
    id,
    label,
    hint = "",
    error = "",
    fieldClassName = "",
    controlClassName = "",
    "aria-describedby": ariaDescribedBy,
    ...props
  },
  ref
) {
  return (
    <label className={joinClassNames(styles.field, fieldClassName)} htmlFor={id}>
      <span className={styles.label}>{label}</span>
      <textarea
        {...props}
        ref={ref}
        id={id}
        className={joinClassNames(styles.control, styles.textarea, controlClassName)}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={describedBy({ id, hint, error, describedBy: ariaDescribedBy })}
      />
      {hint ? (
        <small className={styles.hint} id={`${id}-hint`}>
          {hint}
        </small>
      ) : null}
      {error ? (
        <small className={styles.error} id={`${id}-error`} role="alert">
          {error}
        </small>
      ) : null}
    </label>
  );
});
