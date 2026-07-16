"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { LoadingIconText, LoadingSpinner } from "@/components/loading-spinner";

const NAVIGATION_PENDING_EVENT = "nota5plus:navigation-pending";
const NAVIGATION_RESET_EVENT = "nota5plus:navigation-reset";

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
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams.toString()}`;
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setPending(false);
  }, [routeKey]);

  useEffect(() => {
    function resetNavigation() {
      setPending(false);
    }

    window.addEventListener(NAVIGATION_RESET_EVENT, resetNavigation);
    return () => window.removeEventListener(NAVIGATION_RESET_EVENT, resetNavigation);
  }, []);

  function handleClick(event) {
    if (pending) {
      event.preventDefault();
      return;
    }

    onClick?.(event);

    if (shouldShowPending(event, href)) {
      setPending(true);
      window.dispatchEvent(
        new CustomEvent(NAVIGATION_PENDING_EVENT, {
          detail: { href }
        })
      );
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
          {pending && pendingMode !== "silent" ? (
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
