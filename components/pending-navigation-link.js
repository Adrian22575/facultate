"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { LoadingIconText, LoadingSpinner } from "@/components/loading-spinner";

function shouldShowPending(event, href) {
  if (
    event.defaultPrevented ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    event.button !== 0
  ) {
    return false;
  }

  if (typeof href !== "string") {
    return true;
  }

  return href.startsWith("/") && !href.startsWith("//") && !href.startsWith("#");
}

export function PendingNavigationLink({
  href,
  className,
  children,
  pendingLabel = "Se deschide...",
  pendingMode = "badge",
  onClick,
  ...props
}) {
  const pathname = usePathname();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setPending(false);
  }, [pathname]);

  function handleClick(event) {
    onClick?.(event);

    if (shouldShowPending(event, href)) {
      setPending(true);
    }
  }

  return (
    <Link
      {...props}
      href={href}
      className={className}
      aria-busy={pending ? "true" : undefined}
      data-navigation-pending={pending ? "true" : undefined}
      onClick={handleClick}
    >
      {pending && pendingMode === "replace" ? (
        <LoadingIconText loading loadingLabel={pendingLabel}>
          {children}
        </LoadingIconText>
      ) : (
        <>
          {children}
          {pending ? (
            <span className="navigation-pending-badge" aria-live="polite">
              <LoadingSpinner size={14} />
              <span>{pendingLabel}</span>
            </span>
          ) : null}
        </>
      )}
    </Link>
  );
}
