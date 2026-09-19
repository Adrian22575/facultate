"use client";

import { moduleClassNames } from "@/lib/ui/module-class-names";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { LoadingSpinner } from "@/components/loading-spinner";

import { ADMIN_ROUTE_GROUPS, ADMIN_ROUTES } from "@/lib/admin-routes";

import switcherStyles from "./admin-route-switcher.module.css";

export function AdminRouteSwitcher() {
  const pathname = usePathname();
  const router = useRouter();
  const currentPath = pathname === "/admin" ? "/admin" : pathname;
  const detailRoute = ADMIN_ROUTES.find((route) => pathname?.startsWith(`${route.path}/`));
  const [pendingPath, setPendingPath] = useState("");
  const [isPending, startTransition] = useTransition();
  useEffect(() => setPendingPath(""), [pathname]);

  return (
    <label className={moduleClassNames(switcherStyles, "admin-route-switcher")}>
      <span aria-live="polite">{isPending ? <><LoadingSpinner size={14} /> Se deschide…</> : "Schimbă pagina"}</span>
      <select aria-label="Schimbă pagina" aria-busy={isPending || undefined} disabled={isPending} value={isPending ? pendingPath : currentPath} onChange={(event) => {
        const destination = event.target.value;
        if (destination === currentPath) return;
        setPendingPath(destination);
        startTransition(() => router.push(destination));
      }}>
        <option value="/admin">Prezentare generală</option>
        {detailRoute ? <option value={currentPath} disabled>{detailRoute.label} — detaliu</option> : null}
        {ADMIN_ROUTE_GROUPS.map((group) => (
          <optgroup key={group.id} label={group.label}>
            {group.routes.map((route) => <option key={route.path} value={route.path}>{route.label}</option>)}
          </optgroup>
        ))}
      </select>
    </label>
  );
}
