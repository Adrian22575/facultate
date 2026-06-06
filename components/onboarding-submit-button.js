"use client";

import { useFormStatus } from "react-dom";

import { LoadingIconText } from "@/components/loading-spinner";

export function OnboardingSubmitButton({
  children,
  className,
  disabled = false,
  pendingLabel = "Se salveaza..."
}) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className={className} disabled={disabled || pending}>
      <LoadingIconText loading={pending} loadingLabel={pendingLabel}>
        {children}
      </LoadingIconText>
    </button>
  );
}
