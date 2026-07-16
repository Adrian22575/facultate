"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { LoadingSpinner } from "@/components/loading-spinner";

let isGlobalNavigationPending = false;

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

  useEffect(() => {
    isGlobalNavigationPending = false;
    setPending(false);
  }, [pathname]);

  useEffect(() => {
    function handleNavigation(event) {
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!anchor || !isInternalNavigation(event, anchor)) return;

      if (isGlobalNavigationPending) {
        event.preventDefault();
        return;
      }

      isGlobalNavigationPending = true;
      window.dispatchEvent(
        new CustomEvent("nota5plus:navigation-pending", {
          detail: { href: anchor.getAttribute("href") || anchor.href }
        })
      );
      setPending(true);
    }

    document.addEventListener("click", handleNavigation, true);
    return () => document.removeEventListener("click", handleNavigation, true);
  }, []);

  if (!pending) return null;

  return (
    <div className="global-navigation-feedback" role="status" aria-live="polite">
      <LoadingSpinner size={16} />
      <span>Se deschide pagina...</span>
    </div>
  );
}
