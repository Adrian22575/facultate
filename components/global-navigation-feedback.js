"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import { LoadingSpinner } from "@/components/loading-spinner";

let isGlobalNavigationPending = false;
const NAVIGATION_RESET_EVENT = "nota5plus:navigation-reset";
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
    anchor.hasAttribute("download")
  ) {
    return false;
  }

  const rawHref = anchor.getAttribute("href") || "";
  if (!rawHref || rawHref.startsWith("#") || rawHref.startsWith("//")) return false;

  try {
    return new URL(anchor.href, window.location.href).origin === window.location.origin;
  } catch {
    return false;
  }
}

export function GlobalNavigationFeedback() {
  const pathname = usePathname();
  const [pending, setPending] = useState(false);
  const activationTimeoutRef = useRef(null);
  const recoveryTimeoutRef = useRef(null);

  useEffect(() => {
    if (activationTimeoutRef.current) {
      window.clearTimeout(activationTimeoutRef.current);
      activationTimeoutRef.current = null;
    }
    if (recoveryTimeoutRef.current) {
      window.clearTimeout(recoveryTimeoutRef.current);
      recoveryTimeoutRef.current = null;
    }
    isGlobalNavigationPending = false;
    setPending(false);
    window.dispatchEvent(new CustomEvent(NAVIGATION_RESET_EVENT));
  }, [pathname]);

  useEffect(() => {
    const mainContent = document.getElementById("main-content");
    if (pending) {
      mainContent?.setAttribute("inert", "");
      return () => mainContent?.removeAttribute("inert");
    }

    mainContent?.removeAttribute("inert");
    return undefined;
  }, [pending]);

  useEffect(() => {
    function handleNavigation(event) {
      if (isGlobalNavigationPending) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!anchor || !isInternalNavigation(event, anchor)) return;

      isGlobalNavigationPending = true;
      activationTimeoutRef.current = window.setTimeout(() => {
        activationTimeoutRef.current = null;
        if (isGlobalNavigationPending) {
          setPending(true);
        }
      }, 0);
      recoveryTimeoutRef.current = window.setTimeout(() => {
        isGlobalNavigationPending = false;
        recoveryTimeoutRef.current = null;
        setPending(false);
        window.dispatchEvent(new CustomEvent(NAVIGATION_RESET_EVENT));
      }, NAVIGATION_RECOVERY_MS);
    }

    document.addEventListener("click", handleNavigation, true);
    return () => {
      document.removeEventListener("click", handleNavigation, true);
      if (activationTimeoutRef.current) {
        window.clearTimeout(activationTimeoutRef.current);
      }
      if (recoveryTimeoutRef.current) {
        window.clearTimeout(recoveryTimeoutRef.current);
      }
    };
  }, []);

  if (!pending) return null;

  return (
    <>
      <div className="global-navigation-blocker" aria-hidden="true" />
      <div className="global-navigation-feedback" role="status" aria-live="polite">
        <LoadingSpinner size={16} />
        <span>Se deschide pagina...</span>
      </div>
    </>
  );
}
