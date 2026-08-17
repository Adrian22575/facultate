import { AppHeaderNavigation } from "@/components/app-header-navigation";
import { PendingNavigationLink } from "@/components/pending-navigation-link";
import { isAdminUser } from "@/lib/admin";
import { getBillingSnapshot } from "@/lib/billing";
import { isDemoUser } from "@/lib/demo-user";
import { getGamificationSummary } from "@/lib/gamification";
import { getAdminHeaderActionSummary } from "@/lib/admin-center";
import { measureServerTiming } from "@/lib/server-timing";
import { getOptionalUser } from "@/lib/supabase/guards";

async function renderAppHeader({
  title,
  subtitle,
  action,
  hidePrivateNav = false,
  hidePageTitle = false,
  suppressAdminActionCount = false,
  user: providedUser,
  isAdmin: providedIsAdmin,
  billingSnapshot: providedBillingSnapshot,
  gamificationSummary: providedGamificationSummary,
  adminActionCount: providedAdminActionCount
}) {
  const user = providedUser === undefined
    ? await measureServerTiming("app_header.get_user", getOptionalUser, { component: "AppHeader" })
    : providedUser;
  const demoMode = isDemoUser(user);
  const showLogout = Boolean(user) && !demoMode;
  const showPrivateNav = Boolean(user) && !hidePrivateNav && !demoMode;
  const brandHref = demoMode ? "/auth/exit-demo?next=/" : user ? "/" : "/auth/login";
  const brandPendingLabel = demoMode ? "Ieși din demo..." : "Se deschide pagina principală...";
  const showAdminLink = providedIsAdmin === undefined
    ? await isAdminUser(user)
    : providedIsAdmin;
  const logoutLabel = demoMode ? "Iesi din demo" : "Logout";
  let billingSnapshot = providedBillingSnapshot === undefined ? null : providedBillingSnapshot;
  let gamificationSummary = providedGamificationSummary === undefined ? null : providedGamificationSummary;
  let adminActionCount = providedAdminActionCount === undefined ? 0 : providedAdminActionCount;
  const shouldLoadAdminActionCount =
    showAdminLink &&
    !suppressAdminActionCount &&
    providedAdminActionCount === undefined;
  const adminSummaryPromise = shouldLoadAdminActionCount
    ? getAdminHeaderActionSummary(user.id).catch(() => null)
    : Promise.resolve(null);

  if (user && !demoMode) {
    try {
      const [nextBillingSnapshot, nextGamificationSummary, adminSummary] = await Promise.all([
        providedBillingSnapshot === undefined
          ? getBillingSnapshot(user.id).catch(() => null)
          : providedBillingSnapshot,
        providedGamificationSummary === undefined
          ? getGamificationSummary(user.id).catch(() => null)
          : providedGamificationSummary,
        adminSummaryPromise
      ]);
      billingSnapshot = nextBillingSnapshot;
      gamificationSummary = nextGamificationSummary;
      adminActionCount = adminSummary?.total || adminActionCount;
    } catch {
      billingSnapshot = null;
      gamificationSummary = null;
    }
  } else {
    const adminSummary = await adminSummaryPromise;
    adminActionCount = adminSummary?.total || adminActionCount;
  }

  return (
    <header className="app-header">
      <div className="app-header-row app-mobile-navigation-bar">
        <PendingNavigationLink
          className="brand"
          href={brandHref}
          pendingLabel={brandPendingLabel}
          pendingMode="replace"
        >
          <span className="brand-mark">5+</span>
          <span>Nota 5+</span>
        </PendingNavigationLink>

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

export async function AppHeader(props) {
  return measureServerTiming(
    "app_header",
    () => renderAppHeader(props),
    { component: "AppHeader" }
  );
}
