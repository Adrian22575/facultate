"use client";

import { usePathname } from "next/navigation";
import { BarChart3, Home, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Shield, Trophy, Upload, UserCircle, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { HeaderCreditStatus } from "@/components/header-credit-status";
import { PendingNavigationLink } from "@/components/pending-navigation-link";
import { useDialogFocus } from "@/lib/ui/dialog";

function IconText({ icon: Icon, children, badgeCount = 0 }) {
  return (
    <span className="ui-icon-text">
      <Icon aria-hidden="true" size={18} strokeWidth={2.2} />
      <span>{children}</span>
      {badgeCount > 0 ? <span className="nav-action-badge">{badgeCount}</span> : null}
    </span>
  );
}

function isActivePath(pathname, href) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function HeaderProgressBadge({ summary }) {
  const level = summary?.level?.current || { title: "Incepator", badge: "1" };
  const points = Number(summary?.totalPoints || 0);

  return (
    <PendingNavigationLink
      className="header-progress-badge"
      href="/progresul-meu"
      aria-label={`Progres: ${level.title}`}
      pendingLabel="Se deschide progresul..."
      pendingMode="replace"
    >
      <span className="header-progress-badge-mark" aria-hidden="true">
        {level.badge || "1"}
      </span>
      <span className="header-progress-badge-copy">
        <strong>{level.title}</strong>
        <span>{`${points} puncte`}</span>
      </span>
    </PendingNavigationLink>
  );
}

export function AppHeaderNavigation({
  showPrivateNav,
  showLogout,
  showAdminLink,
  adminActionCount,
  logoutLabel,
  billingSnapshot = null,
  gamificationSummary = null
}) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [pageScrolled, setPageScrolled] = useState(false);
  const [portalTarget, setPortalTarget] = useState(null);
  const menuButtonRef = useRef(null);
  const menuCloseButtonRef = useRef(null);
  const menuPanelRef = useDialogFocus(
    mobileMenuOpen,
    () => setMobileMenuOpen(false),
    menuCloseButtonRef
  );
  const links = showPrivateNav
    ? [
        { href: "/", label: "Home", icon: Home },
        { href: "/materiale", label: "Materiale", icon: Upload },
        { href: "/progresul-meu", label: "Progres", icon: Trophy },
        { href: "/statistici", label: "Statistici", icon: BarChart3 },
        { href: "/cont", label: "Contul meu", icon: UserCircle },
        ...(showAdminLink ? [{ href: "/admin", label: "Admin", icon: Shield, badgeCount: adminActionCount }] : [])
      ]
    : [];

  useEffect(() => {
    try {
      setDesktopCollapsed(window.localStorage.getItem("nota5plus_sidebar_collapsed") === "true");
    } catch {
      setDesktopCollapsed(false);
    }
  }, []);

  useEffect(() => {
    setPortalTarget(document.body);
  }, []);

  useEffect(() => {
    function updateScrollState() {
      setPageScrolled(window.scrollY > 8);
    }

    updateScrollState();
    window.addEventListener("scroll", updateScrollState, { passive: true });

    return () => {
      window.removeEventListener("scroll", updateScrollState);
    };
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) return undefined;
    document.body.classList.add("app-mobile-menu-open");

    return () => {
      document.body.classList.remove("app-mobile-menu-open");
    };
  }, [mobileMenuOpen]);

  function navigationLinks(className, onNavigate) {
    return links.map(({ href, label, icon, badgeCount = 0 }) => {
      const active = isActivePath(pathname, href);
      return (
        <PendingNavigationLink
          key={href}
          className={`${className} ${active ? "is-active" : ""} ${badgeCount > 0 ? "has-admin-action" : ""}`}
          href={href}
          aria-current={active ? "page" : undefined}
          onClick={onNavigate}
          pendingLabel="Se deschide..."
          pendingMode="replace"
        >
          <IconText icon={icon} badgeCount={badgeCount}>{label}</IconText>
        </PendingNavigationLink>
      );
    });
  }

  function toggleDesktopSidebar() {
    setDesktopCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem("nota5plus_sidebar_collapsed", String(next));
      } catch {
        // Persistence is helpful, not required.
      }
      return next;
    });
  }

  function SidebarContent({ variant, closeButtonRef = null }) {
    const isDesktop = variant === "desktop";
    const collapsed = isDesktop && desktopCollapsed;

    return (
      <>
        {isDesktop ? (
          <div className="app-sidebar-top">
            <PendingNavigationLink
              className="app-sidebar-brand"
              href="/"
              aria-label="Nota 5+"
              pendingLabel="Se deschide pagina principala..."
              pendingMode="replace"
            >
              <span className="brand-mark">5+</span>
              <span className="app-sidebar-brand-copy">
                <strong>Nota 5+</strong>
                <small>Invata mai usor</small>
              </span>
            </PendingNavigationLink>

            <button
              type="button"
              className="app-sidebar-toggle"
              aria-label={collapsed ? "Extinde meniul" : "Restrange meniul"}
              onClick={toggleDesktopSidebar}
            >
              {collapsed ? (
                <PanelLeftOpen aria-hidden="true" size={18} strokeWidth={2.25} />
              ) : (
                <PanelLeftClose aria-hidden="true" size={18} strokeWidth={2.25} />
              )}
            </button>
          </div>
        ) : (
          <div className="header-side-menu-top">
            <div>
              <span>Navigare</span>
              <strong>Meniu principal</strong>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              className="header-side-menu-collapse"
              aria-label="Inchide meniul"
              onClick={() => setMobileMenuOpen(false)}
            >
              <X aria-hidden="true" size={19} strokeWidth={2.35} />
            </button>
          </div>
        )}

        {showPrivateNav ? (
          <nav className="app-sidebar-links" aria-label="Navigare principala">
            {navigationLinks(
              "app-sidebar-link",
              isDesktop ? undefined : () => setMobileMenuOpen(false)
            )}
          </nav>
        ) : null}

        <div className="app-sidebar-footer">
          {showPrivateNav ? <HeaderProgressBadge summary={gamificationSummary} /> : null}
          {billingSnapshot ? <HeaderCreditStatus billingSnapshot={billingSnapshot} /> : null}
          {showLogout ? (
            <form className="app-sidebar-logout-form" action="/auth/signout" method="post">
              <button className="app-sidebar-logout-button" type="submit">
                <IconText icon={LogOut}>{logoutLabel}</IconText>
              </button>
            </form>
          ) : null}
        </div>
      </>
    );
  }

  return (
    <div className="header-actions" data-page-scrolled={pageScrolled ? "true" : "false"}>
      {showPrivateNav ? (
        <aside className={`app-sidebar ${desktopCollapsed ? "is-collapsed" : ""}`} aria-label="Meniu aplicatie">
          <SidebarContent variant="desktop" />
        </aside>
      ) : null}

      {showPrivateNav || showLogout ? (
        <button
          className="header-mobile-menu-button"
          ref={menuButtonRef}
          type="button"
          aria-haspopup="true"
          aria-expanded={mobileMenuOpen}
          aria-controls="app-mobile-navigation"
          aria-label={
            adminActionCount > 0
              ? `Deschide meniul. ${adminActionCount} notificari.`
              : "Deschide meniul"
          }
          onClick={() => setMobileMenuOpen((current) => !current)}
        >
          <Menu aria-hidden="true" size={21} strokeWidth={2.2} />
          <span>Meniu</span>
          {adminActionCount > 0 ? <span className="nav-action-badge">{adminActionCount}</span> : null}
        </button>
      ) : null}

      {portalTarget && mobileMenuOpen
        ? createPortal(
            <div className="header-side-menu-layer" role="presentation">
              <button
                className="header-side-menu-scrim"
                type="button"
                aria-label="Inchide meniul"
                onClick={() => setMobileMenuOpen(false)}
              />
              <aside
                id="app-mobile-navigation"
                className="header-mobile-menu-panel app-sidebar-mobile"
                ref={menuPanelRef}
                role="dialog"
                aria-modal="true"
                aria-label="Meniu principal"
                tabIndex={-1}
              >
                <SidebarContent variant="mobile" closeButtonRef={menuCloseButtonRef} />
              </aside>
            </div>,
            portalTarget
          )
        : null}
    </div>
  );
}
