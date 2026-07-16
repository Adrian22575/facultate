"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { LoadingSpinner } from "@/components/loading-spinner";

const NAVIGATION_RESET_EVENT = "nota5plus:navigation-reset";
const NAVIGATION_INDICATOR_DELAY_MS = 280;
const NAVIGATION_RECOVERY_MS = 10_000;

function isInternalNavigation(event, anchor) {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    anchor.target ||
    anchor.hasAttribute("download") ||
    anchor.getAttribute("aria-disabled") === "true"
  ) {
    return false;
  }

  const rawHref = anchor.getAttribute("href") || "";
  if (!rawHref || rawHref.startsWith("#") || rawHref.startsWith("//")) return false;

  try {
    const destination = new URL(anchor.href, window.location.href);
    return destination.origin === window.location.origin && destination.href !== window.location.href;
  } catch {
    return false;
  }
}

export function GlobalNavigationFeedback() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams.toString()}`;
  const [pending, setPending] = useState(false);
  const activationTimeoutRef = useRef(null);
  const recoveryTimeoutRef = useRef(null);
  const activeAnchorRef = useRef(null);

  function resetNavigation() {
    if (activationTimeoutRef.current) {
      window.clearTimeout(activationTimeoutRef.current);
      activationTimeoutRef.current = null;
    }
    if (recoveryTimeoutRef.current) {
      window.clearTimeout(recoveryTimeoutRef.current);
      recoveryTimeoutRef.current = null;
    }

    activeAnchorRef.current?.removeAttribute("aria-busy");
    activeAnchorRef.current?.removeAttribute("data-navigation-pending");
    activeAnchorRef.current = null;
    setPending(false);
    window.dispatchEvent(new CustomEvent(NAVIGATION_RESET_EVENT));
  }

  useEffect(() => {
    resetNavigation();
  }, [routeKey]);

  useEffect(() => {
    function handleNavigation(event) {
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!anchor || !isInternalNavigation(event, anchor)) return;

      if (activeAnchorRef.current === anchor) {
        event.preventDefault();
        return;
      }

      resetNavigation();
      activeAnchorRef.current = anchor;
      anchor.setAttribute("aria-busy", "true");
      anchor.setAttribute("data-navigation-pending", "true");

      activationTimeoutRef.current = window.setTimeout(() => {
        activationTimeoutRef.current = null;
        if (activeAnchorRef.current === anchor) {
          setPending(true);
        }
      }, NAVIGATION_INDICATOR_DELAY_MS);

      recoveryTimeoutRef.current = window.setTimeout(resetNavigation, NAVIGATION_RECOVERY_MS);
    }

    document.addEventListener("click", handleNavigation, true);
    return () => {
      document.removeEventListener("click", handleNavigation, true);
      resetNavigation();
    };
  }, []);

  if (!pending) return null;

  return (
    <div className="global-navigation-feedback" role="status" aria-live="polite">
      <LoadingSpinner size={16} />
      <span>Se deschide pagina...</span>
    </div>
  );
}
