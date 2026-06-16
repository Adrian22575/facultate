import Link from "next/link";
import { BarChart3, Home, LogOut, Shield, UserCircle } from "lucide-react";

import { HeaderCreditStatus } from "@/components/header-credit-status";
import { isAdminUser } from "@/lib/admin";
import { getBillingSnapshot } from "@/lib/billing";
import { isDemoUser } from "@/lib/demo-user";
import { getAdminActionSummary } from "@/lib/admin-center";
import { getOptionalUser } from "@/lib/supabase/guards";

function IconText({ icon: Icon, children, badgeCount = 0 }) {
  return (
    <span className="ui-icon-text">
      <Icon aria-hidden="true" size={16} strokeWidth={2.2} />
      <span>{children}</span>
      {badgeCount > 0 ? <span className="nav-action-badge">{badgeCount}</span> : null}
    </span>
  );
}

export async function AppHeader({
  title,
  subtitle,
  action,
  hidePrivateNav = false,
  hidePageTitle = false,
  suppressAdminActionCount = false
}) {
  const user = await getOptionalUser();
  const demoMode = isDemoUser(user);
  const showLogout = Boolean(user);
  const showPrivateNav = Boolean(user) && !hidePrivateNav && !demoMode;
  const showAdminLink = await isAdminUser(user);
  const logoutLabel = demoMode ? "Iesi din demo" : "Logout";
  let billingSnapshot = null;
  let adminActionCount = 0;

  if (user && !demoMode) {
    try {
      billingSnapshot = await getBillingSnapshot(user.id);
    } catch {
      billingSnapshot = null;
    }
  }

  if (showAdminLink && !suppressAdminActionCount) {
    try {
      const adminSummary = await getAdminActionSummary(user.id);
      adminActionCount = adminSummary.total || 0;
    } catch {
      adminActionCount = 0;
    }
  }

  return (
    <header className="app-header">
      <div className="app-header-row">
        <Link className="brand" href={demoMode ? "/demo" : user ? "/" : "/auth/login"}>
          <span className="brand-mark">5+</span>
          <span>Nota 5+</span>
        </Link>

        <div className="header-actions">
          {showPrivateNav ? (
            <nav className="header-shortcuts" aria-label="Navigare rapida">
              <Link className="btn-link btn-primary header-shortcut-link" href="/">
                <IconText icon={Home}>Home</IconText>
              </Link>
              <Link className="btn-link secondary header-shortcut-link" href="/statistici">
                <IconText icon={BarChart3}>Statistici</IconText>
              </Link>
              <Link className="btn-link secondary header-shortcut-link" href="/cont">
                <IconText icon={UserCircle}>Contul meu</IconText>
              </Link>
              {showAdminLink ? (
                <Link className={`btn-link secondary header-shortcut-link ${adminActionCount > 0 ? "has-admin-action" : ""}`} href="/admin">
                  <IconText icon={Shield} badgeCount={adminActionCount}>Admin</IconText>
                </Link>
              ) : null}
            </nav>
          ) : null}
          {showLogout ? (
            <form action="/auth/signout" method="post">
              <button className="btn-link secondary header-logout-btn" type="submit">
                <IconText icon={LogOut}>{logoutLabel}</IconText>
              </button>
            </form>
          ) : null}
        </div>
      </div>

      {billingSnapshot ? (
        <div className="app-header-credit-row">
          <HeaderCreditStatus billingSnapshot={billingSnapshot} />
        </div>
      ) : null}

      {action ? (
        <div className="app-header-row">
          {action}
        </div>
      ) : null}

      {!hidePageTitle ? <h1 className="page-title">{title}</h1> : null}
      {!hidePageTitle && subtitle ? <p className="app-subtitle">{subtitle}</p> : null}
      {demoMode ? (
        <div className="app-header-demo-row">
          <span className="status-pill is-warning">Esti in demo</span>
          <p>Poti testa modul de invatare. Pentru progres real, materiale si generare, intra cu Google.</p>
        </div>
      ) : null}
    </header>
  );
}
