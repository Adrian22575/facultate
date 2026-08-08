"use client";

import { useState } from "react";
import styles from "./onboarding-role-choice-lock.module.css";

export function OnboardingRoleChoiceLock({ children }) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleSubmitCapture(event) {
    if (isSubmitting) {
      event.preventDefault();
      return;
    }

    event.currentTarget.querySelectorAll('button[type="submit"]').forEach((button) => {
      button.disabled = true;
      button.setAttribute("aria-disabled", "true");
    });
    setIsSubmitting(true);
  }

  return (
    <div
      className={[styles["onboarding-type-grid"], isSubmitting && styles["is-submitting"]].filter(Boolean).join(" ")}
      aria-busy={isSubmitting ? "true" : undefined}
      onSubmitCapture={handleSubmitCapture}
    >
      {children}
    </div>
  );
}
