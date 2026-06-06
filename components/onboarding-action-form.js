"use client";

import { useMemo, useState } from "react";

import { OnboardingSubmitButton } from "@/components/onboarding-submit-button";

function getInitialValues(rows) {
  const values = {};

  rows.flat().forEach((field) => {
    values[field.name] = field.defaultValue ?? "";
  });

  return values;
}

function getFormDefaults(rows, fieldDefaults) {
  const defaults = { ...fieldDefaults };
  const fields = rows.flat();
  const hasNameField = fields.some((field) => field.name === "name");
  const hasCityField = fields.some((field) => field.name === "city");
  const rawName = typeof defaults.name === "string" ? defaults.name.trim() : "";
  const commaIndex = rawName.indexOf(",");

  if (hasNameField && hasCityField && commaIndex > 0) {
    const parsedName = rawName.slice(0, commaIndex).trim();
    const parsedCity = rawName.slice(commaIndex + 1).split(",")[0].trim();

    if (parsedName) {
      defaults.name = parsedName;
    }

    if (parsedCity && !defaults.city) {
      defaults.city = parsedCity;
    }
  }

  return defaults;
}

function getFieldError(field, value) {
  const normalizedValue = typeof value === "string" ? value.trim() : value;

  if (field.required && !normalizedValue) {
    return field.errorMessage || "Completeaza campul.";
  }

  if (normalizedValue && field.minLength && normalizedValue.length < field.minLength) {
    return field.errorMessage || `Scrie cel putin ${field.minLength} caractere.`;
  }

  if (normalizedValue && field.maxLength && normalizedValue.length > field.maxLength) {
    return `Maxim ${field.maxLength} caractere.`;
  }

  return "";
}

export function OnboardingActionForm({
  action,
  fieldDefaults = {},
  hiddenFields = [],
  rows,
  submitLabel,
  className = ""
}) {
  const preparedRows = useMemo(
    () => {
      const defaults = getFormDefaults(rows, fieldDefaults);

      return rows.map((row) =>
        row.map((field) => ({
          ...field,
          defaultValue: field.defaultValue ?? defaults[field.name]
        }))
      );
    },
    [fieldDefaults, rows]
  );
  const [values, setValues] = useState(() => getInitialValues(preparedRows));
  const [touched, setTouched] = useState({});
  const [attempted, setAttempted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const errors = useMemo(() => {
    const nextErrors = {};

    preparedRows.flat().forEach((field) => {
      nextErrors[field.name] = getFieldError(field, values[field.name]);
    });

    return nextErrors;
  }, [preparedRows, values]);

  const isValid = Object.values(errors).every((value) => !value);

  function updateValue(name, value) {
    if (isSubmitting) {
      return;
    }

    setValues((current) => ({
      ...current,
      [name]: value
    }));
  }

  return (
    <form
      action={action}
      className={className}
      onSubmit={(event) => {
        setAttempted(true);

        if (!isValid) {
          event.preventDefault();
          return;
        }

        setIsSubmitting(true);
      }}
    >
      {hiddenFields.map((field) => (
        <input key={field.name} type="hidden" name={field.name} value={field.value} />
      ))}

      {preparedRows.map((row, rowIndex) => (
        <div
          key={`row-${rowIndex}`}
          className={row.length > 1 ? "selector-grid onboarding-form-grid" : "onboarding-form-stack"}
        >
          {row.map((field) => {
            const showError = Boolean((attempted || touched[field.name]) && errors[field.name]);

            return (
              <label key={field.name} className="onboarding-form-field">
                <span>{field.label}</span>
                {field.type === "select" ? (
                  <select
                    name={field.name}
                    value={values[field.name]}
                    disabled={isSubmitting}
                    onChange={(event) => updateValue(field.name, event.target.value)}
                    onBlur={() =>
                      setTouched((current) => ({
                        ...current,
                        [field.name]: true
                      }))
                    }
                    required={field.required}
                  >
                    <option value="">{field.placeholder || "Alege"}</option>
                    {field.options?.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="input-search"
                    type={field.type || "text"}
                    name={field.name}
                    value={values[field.name]}
                    placeholder={field.placeholder}
                    required={field.required}
                    disabled={isSubmitting}
                    minLength={field.minLength}
                    maxLength={field.maxLength}
                    onChange={(event) => updateValue(field.name, event.target.value)}
                    onBlur={() =>
                      setTouched((current) => ({
                        ...current,
                        [field.name]: true
                      }))
                    }
                  />
                )}
                {showError ? (
                  <span className="onboarding-field-error">{errors[field.name]}</span>
                ) : null}
              </label>
            );
          })}
        </div>
      ))}

      <div className="inline-actions">
        <OnboardingSubmitButton disabled={!isValid || isSubmitting}>
          {submitLabel}
        </OnboardingSubmitButton>
      </div>
    </form>
  );
}
