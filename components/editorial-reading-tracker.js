"use client";

import { useEffect, useRef } from "react";

export function EditorialReadingTracker() {
  const sent = useRef(new Set());
  useEffect(() => {
    const send = (event) => { if (sent.current.has(event)) return; sent.current.add(event); fetch("/api/usage/events", { method: "POST", headers: { "content-type": "application/json" }, keepalive: true, body: JSON.stringify({ eventType: event, path: window.location.pathname }) }).catch(() => {}); };
    const onScroll = () => { const height = document.documentElement.scrollHeight - window.innerHeight; if (height <= 0) return; const progress = window.scrollY / height; if (progress >= .5) send("editorial_read_50"); if (progress >= .9) send("editorial_read_90"); };
    window.addEventListener("scroll", onScroll, { passive: true }); onScroll(); return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return null;
}
