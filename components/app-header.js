import Link from "next/link";

import { AppHeaderNavigation } from "@/components/app-header-navigation";
import { isAdminUser } from "@/lib/admin";
import { getBillingSnapshot } from "@/lib/billing";
import { isDemoUser } from "@/lib/demo-user";
import { getGamificationSummary } from "@/lib/gamification";
import { getAdminActionSummary } from "@/lib/admin-center";
import { getOptionalUser } from "@/lib/supabase/guards";

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
  let gamificationSummary = null;
  let adminActionCount = 0;

  if (user && !demoMode) {
    try {
      [billingSnapshot, gamificationSummary] = await Promise.all([
        getBillingSnapshot(user.id).catch(() => null),
        getGamificationSummary(user.id).catch(() => null)
      ]);
    } catch {
      billingSnapshot = null;
      gamificationSummary = null;
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

        <AppHeaderNavigation
          showPrivateNav={showPrivateNav}
          showLogout={showLogout}
          showAdminLink={showAdminLink}
          adminActionCount={adminActionCount}
          logoutLabel={logoutLabel}
          billingSnapshot={billingSnapshot}
          gamificationSummary={gamificationSummary}
        />
      </div>

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
          <p>Poti testa modul de invatare. Pentru progres real, materiale si generare, intra in cont.</p>
        </div>
      ) : null}
    </header>
  );
}
