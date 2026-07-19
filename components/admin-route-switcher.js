"use client";

import { usePathname, useRouter } from "next/navigation";

import { ADMIN_ROUTE_GROUPS } from "@/lib/admin-routes";

export function AdminRouteSwitcher() {
  const pathname = usePathname();
  const router = useRouter();
  const currentPath = pathname === "/admin" ? "/admin" : pathname;

  return (
    <label className="admin-route-switcher">
      <span>Schimbă pagina</span>
      <select value={currentPath} onChange={(event) => router.push(event.target.value)}>
        <option value="/admin">Prezentare generală</option>
        {ADMIN_ROUTE_GROUPS.map((group) => (
          <optgroup key={group.id} label={group.label}>
            {group.routes.map((route) => <option key={route.path} value={route.path}>{route.label}</option>)}
          </optgroup>
        ))}
      </select>
    </label>
  );
}
