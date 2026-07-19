import {
  AlertTriangle,
  BarChart3,
  BookText,
  Building2,
  CreditCard,
  GraduationCap,
  KeyRound,
  LayoutDashboard,
  MessageSquareText,
  Newspaper,
  ReceiptText,
  School,
  Send,
  ServerCog,
  ShieldCheck,
  Star,
  Users
} from "lucide-react";
import Link from "next/link";

import { AdminMobileNavigation } from "@/components/admin-mobile-navigation";
import { AppHeader } from "@/components/app-header";
import { ADMIN_ROUTE_GROUPS } from "@/lib/admin-routes";

const ICONS = {
  alert: AlertTriangle,
  book: BookText,
  building: Building2,
  chart: BarChart3,
  "credit-card": CreditCard,
  graduation: GraduationCap,
  key: KeyRound,
  message: MessageSquareText,
  newspaper: Newspaper,
  receipt: ReceiptText,
  school: School,
  send: Send,
  server: ServerCog,
  shield: ShieldCheck,
  star: Star,
  users: Users
};

export function AdminPageShell({ activeRoute = null, children }) {
  const title = activeRoute?.label || "Admin Center";
  const description = activeRoute?.description || "Alege zona în care vrei să lucrezi. Fiecare pagină păstrează un singur scop administrativ.";

  return (
    <main className="app-shell admin-app-shell">
      <AppHeader suppressAdminActionCount hidePageTitle />
      <div className="admin-route-shell">
        <aside className="admin-route-sidebar">
          <Link className={`admin-route-home${!activeRoute ? " is-current" : ""}`} href="/admin" aria-current={!activeRoute ? "page" : undefined}>
            <LayoutDashboard size={18} aria-hidden="true" />
            <span><strong>Admin Center</strong><small>Prezentare generală</small></span>
          </Link>
          <nav className="admin-route-navigation" aria-label="Navigație Admin">
            {ADMIN_ROUTE_GROUPS.map((group) => (
              <section key={group.id} className="admin-route-nav-group">
                <div><strong>{group.label}</strong><small>{group.description}</small></div>
                <ul>
                  {group.routes.map((route) => {
                    const Icon = ICONS[route.icon] || LayoutDashboard;
                    const current = activeRoute?.path === route.path;
                    return (
                      <li key={route.path}>
                        <Link href={route.path} className={current ? "is-current" : ""} aria-current={current ? "page" : undefined}>
                          <Icon size={16} aria-hidden="true" /><span>{route.label}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </nav>
        </aside>

        <div className="admin-route-workspace">
          <AdminMobileNavigation />
          <nav className="admin-route-breadcrumbs" aria-label="Breadcrumb">
            <ol>
              <li>{activeRoute ? <Link href="/admin">Admin</Link> : <span aria-current="page">Admin</span>}</li>
              {activeRoute ? <li><span>{activeRoute.groupLabel}</span></li> : null}
              {activeRoute ? <li><span aria-current="page">{activeRoute.label}</span></li> : null}
            </ol>
          </nav>
          <header className="admin-route-header">
            <span>{activeRoute?.groupLabel || "Control și organizare"}</span>
            <h1>{title}</h1>
            <p>{description}</p>
          </header>
          <div className="admin-route-content">{children}</div>
        </div>
      </div>
    </main>
  );
}
