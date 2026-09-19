import { moduleClassNames } from "@/lib/ui/module-class-names";
import { ChevronRight, LayoutDashboard } from "lucide-react";
import { PendingNavigationLink as Link } from "@/components/pending-navigation-link";

import { AdminRouteSwitcher } from "@/components/admin-route-switcher";
import { AppHeader } from "@/components/app-header";

import adminStyles from "./admin-page-shell.module.css";

export function AdminPageShell({
  activeRoute = null,
  breadcrumbLabel = "",
  children,
  hideHeader = false
}) {
  const title = activeRoute?.label || "Admin Center";
  const description = activeRoute?.description || "Alege zona în care vrei să lucrezi. Fiecare pagină păstrează un singur scop administrativ.";

  return (
    <main className={moduleClassNames(adminStyles, "app-shell admin-app-shell")}>
      <AppHeader suppressAdminActionCount hidePageTitle />
      <div className={moduleClassNames(adminStyles, "admin-route-shell")}>
        <div className={moduleClassNames(adminStyles, "admin-route-workspace")}>
          <div className={moduleClassNames(adminStyles, "admin-route-topbar")}>
            <nav className={moduleClassNames(adminStyles, "admin-route-location")} aria-label="Locație Admin">
              <Link href="/admin" aria-current={!activeRoute ? "page" : undefined}>
                <LayoutDashboard size={16} aria-hidden="true" />
                Admin Center
              </Link>
              {activeRoute ? <ChevronRight size={14} aria-hidden="true" /> : null}
              {activeRoute ? <span>{activeRoute.groupLabel}</span> : null}
              {activeRoute ? <ChevronRight size={14} aria-hidden="true" /> : null}
              {activeRoute ? (
                <strong aria-current={breadcrumbLabel ? undefined : "page"}>{activeRoute.label}</strong>
              ) : null}
              {breadcrumbLabel ? <ChevronRight size={14} aria-hidden="true" /> : null}
              {breadcrumbLabel ? <strong aria-current="page">{breadcrumbLabel}</strong> : null}
            </nav>
            <AdminRouteSwitcher />
          </div>
          {!hideHeader ? (
            <header className={moduleClassNames(adminStyles, "admin-route-header")}>
              <span>{activeRoute?.groupLabel || "Control și organizare"}</span>
              <h1>{title}</h1>
              <p>{description}</p>
            </header>
          ) : null}
          <div className={moduleClassNames(adminStyles, "admin-route-content")}>{children}</div>
        </div>
      </div>
    </main>
  );
}
