"use client";

import { useState } from "react";

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
      className={`mode-grid onboarding-type-grid${isSubmitting ? " is-submitting" : ""}`}
      aria-busy={isSubmitting ? "true" : undefined}
      onSubmitCapture={handleSubmitCapture}
    >
      {children}
    </div>
  );
}
