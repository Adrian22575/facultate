"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { LoadingIconText, LoadingSpinner } from "@/components/loading-spinner";

const NAVIGATION_PENDING_EVENT = "nota5plus:navigation-pending";
const NAVIGATION_RESET_EVENT = "nota5plus:navigation-reset";
let activeNavigationHref = "";

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
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    activeNavigationHref = "";
    setPending(false);
    setBlocked(false);
  }, [pathname]);

  useEffect(() => {
    function handleNavigationPending(event) {
      const nextHref = event?.detail?.href;
      if (!nextHref || nextHref === href) {
        return;
      }

      activeNavigationHref = nextHref;
      setBlocked(true);
    }

    window.addEventListener(NAVIGATION_PENDING_EVENT, handleNavigationPending);
    return () => window.removeEventListener(NAVIGATION_PENDING_EVENT, handleNavigationPending);
  }, [href]);

  useEffect(() => {
    function resetNavigation() {
      activeNavigationHref = "";
      setPending(false);
      setBlocked(false);
    }

    window.addEventListener(NAVIGATION_RESET_EVENT, resetNavigation);
    return () => window.removeEventListener(NAVIGATION_RESET_EVENT, resetNavigation);
  }, []);

  function handleClick(event) {
    if (blocked || activeNavigationHref) {
      event.preventDefault();
      return;
    }

    onClick?.(event);

    if (shouldShowPending(event, href)) {
      activeNavigationHref = href;
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
      aria-disabled={blocked ? "true" : undefined}
      tabIndex={blocked ? -1 : props.tabIndex}
      data-navigation-blocked={blocked ? "true" : undefined}
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
