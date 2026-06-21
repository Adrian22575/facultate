"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePathname } from "next/navigation";

import { sanitizeUsagePath, sanitizeUsageQuery } from "@/lib/usage-events";

const SESSION_KEY = "nota5plus_usage_session_id";
const ENDPOINT = "/api/usage/events";
const CLICK_THROTTLE_MS = 700;

function createSessionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getSessionId() {
  try {
    const existing = window.localStorage.getItem(SESSION_KEY);

    if (existing) {
      return existing;
    }

    const next = createSessionId();
    window.localStorage.setItem(SESSION_KEY, next);
    return next;
  } catch {
    return createSessionId();
  }
}

function getDeviceType() {
  const width = window.innerWidth || 0;

  if (!width) {
    return "unknown";
  }

  if (width < 760) {
    return "mobile";
  }

  if (width < 1100) {
    return "tablet";
  }

  return "desktop";
}

function getFeatureFromPath(pathname) {
  if (!pathname || pathname === "/") {
    return "Acasa";
  }

  if (pathname.startsWith("/admin")) {
    return "Admin";
  }

  if (pathname.startsWith("/ai") || pathname.startsWith("/materiale")) {
    return "Workspace";
  }

  if (pathname.startsWith("/materii")) {
    return "Materii";
  }

  if (pathname.startsWith("/testele-mele")) {
    return "Testele mele";
  }

  if (pathname.startsWith("/licenta-exam")) {
    return "Licenta";
  }

  if (pathname.startsWith("/cont") || pathname.startsWith("/billing")) {
    return "Cont";
  }

  if (pathname.startsWith("/auth")) {
    return "Autentificare";
  }

  if (pathname.startsWith("/onboarding")) {
    return "Onboarding";
  }

  if (pathname.startsWith("/review-reward")) {
    return "Review reward";
  }

  return pathname.split("/").filter(Boolean)[0] || "General";
}

function shouldTrackPath(pathname) {
  return !pathname?.startsWith("/admin");
}

function normalizeSameOriginPath(value) {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value, window.location.origin);

    if (url.origin !== window.location.origin) {
      return "external";
    }

    const safePath = sanitizeUsagePath(url.pathname);
    const safeQuery = sanitizeUsageQuery(url.search);
    return safePath ? `${safePath}${safeQuery || ""}`.slice(0, 300) : null;
  } catch {
    return null;
  }
}

function getElementLabel(element) {
  const explicitLabel =
    element.getAttribute("data-usage-label") ||
    element.getAttribute("aria-label") ||
    element.getAttribute("title");

  if (explicitLabel) {
    return explicitLabel.trim().slice(0, 120);
  }

  return (element.textContent || "").replace(/\s+/g, " ").trim().slice(0, 120);
}

function postUsageEvent(payload) {
  try {
    const body = JSON.stringify(payload);

    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon(ENDPOINT, blob);
      return;
    }

    fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      credentials: "same-origin",
      keepalive: true,
      body
    }).catch(() => {});
  } catch {
    // Analytics must never block the product.
  }
}

export function UsageTracker() {
  const pathname = usePathname();
  const sessionIdRef = useRef("");
  const lastClickRef = useRef({ key: "", timestamp: 0 });
  const feature = useMemo(() => getFeatureFromPath(pathname), [pathname]);

  useEffect(() => {
    sessionIdRef.current = getSessionId();
  }, []);

  useEffect(() => {
    if (!pathname || !sessionIdRef.current || !shouldTrackPath(pathname)) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      postUsageEvent({
        eventName: "page_view",
        sessionId: sessionIdRef.current,
        feature,
        routePath: sanitizeUsagePath(pathname),
        routeQuery: sanitizeUsageQuery(window.location.search),
        referrerPath: normalizeSameOriginPath(document.referrer),
        deviceType: getDeviceType(),
        viewportWidth: window.innerWidth || null,
        viewportHeight: window.innerHeight || null,
        metadata: {
          title: document.title
        }
      });
    }, 120);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [feature, pathname]);

  useEffect(() => {
    function handleClick(event) {
      if (!shouldTrackPath(pathname)) {
        return;
      }

      const target = event.target?.closest?.("button,a,[data-usage-event]");

      if (!target) {
        return;
      }

      const eventName = target.getAttribute("data-usage-event") || "ui_click";
      const label = getElementLabel(target);
      const href = target.tagName === "A" ? normalizeSameOriginPath(target.getAttribute("href")) : null;
      const key = `${eventName}:${pathname}:${label}:${href || ""}`;
      const now = Date.now();

      if (lastClickRef.current.key === key && now - lastClickRef.current.timestamp < CLICK_THROTTLE_MS) {
        return;
      }

      lastClickRef.current = { key, timestamp: now };

      postUsageEvent({
        eventName,
        sessionId: sessionIdRef.current || getSessionId(),
        feature: getFeatureFromPath(pathname),
        routePath: sanitizeUsagePath(pathname || window.location.pathname),
        routeQuery: sanitizeUsageQuery(window.location.search),
        deviceType: getDeviceType(),
        viewportWidth: window.innerWidth || null,
        viewportHeight: window.innerHeight || null,
        metadata: {
          tag: target.tagName.toLowerCase(),
          label,
          href,
          type: target.getAttribute("type") || null
        }
      });
    }

    document.addEventListener("click", handleClick, true);

    return () => {
      document.removeEventListener("click", handleClick, true);
    };
  }, [pathname]);

  return null;
}
