"use client";

import { usePathname, useRouter } from "next/navigation";

import { ADMIN_ROUTE_GROUPS } from "@/lib/admin-routes";

export function AdminMobileNavigation() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <label className="admin-mobile-navigation">
      <span>Secțiune Admin</span>
      <select value={pathname === "/admin" ? "/admin" : pathname} onChange={(event) => router.push(event.target.value)}>
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
