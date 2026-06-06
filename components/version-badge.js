"use client";

import { useEffect, useState } from "react";

const UPDATED_AT = "2026-04-11T06:51:51Z";

export function VersionBadge() {
  const [label, setLabel] = useState("v2.3 · actualizat: se calculează ora locală...");

  useEffect(() => {
    const updatedDate = new Date(UPDATED_AT);
    const localTime = new Intl.DateTimeFormat("ro-RO", {
      dateStyle: "short",
      timeStyle: "medium"
    }).format(updatedDate);

    const userTimeZone =
      Intl.DateTimeFormat().resolvedOptions().timeZone || "fus local";

    setLabel(`v2.3 · actualizat: ${localTime} (${userTimeZone})`);
  }, []);

  return (
    <div className="version-badge" aria-label="Versiune aplicație">
      {label}
    </div>
  );
}
