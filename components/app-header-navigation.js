"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Home, LogOut, Menu, Shield, Trophy, Upload, UserCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";

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
  const points = Number(summary.totalPoints || 0);

  return (
    <Link className="header-progress-badge" href="/progresul-meu" aria-label={`Progres: ${level.title}`}>
      <span className="header-progress-badge-mark" aria-hidden="true">
        {level.badge || "1"}
      </span>
      <span className="header-progress-badge-copy">
        <strong>{level.title}</strong>
        <span>{`${points} puncte`}</span>
      </span>
    </Link>
  );
}

export function AppHeaderNavigation({
  showPrivateNav,
  showLogout,
  showAdminLink,
  adminActionCount,
  logoutLabel,
  gamificationSummary = null
}) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuRootRef = useRef(null);
  const menuButtonRef = useRef(null);
  const menuPanelRef = useRef(null);
  const links = showPrivateNav
    ? [
        { href: "/", label: "Home", icon: Home },
        { href: "/materiale", label: "Workspace", icon: Upload },
        { href: "/progresul-meu", label: "Progres", icon: Trophy },
        { href: "/statistici", label: "Statistici", icon: BarChart3 },
        { href: "/cont", label: "Contul meu", icon: UserCircle },
        ...(showAdminLink ? [{ href: "/admin", label: "Admin", icon: Shield, badgeCount: adminActionCount }] : [])
      ]
    : [];

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) return undefined;

    function closeMenu({ restoreFocus = false } = {}) {
      setMobileMenuOpen(false);
      if (restoreFocus) {
        window.requestAnimationFrame(() => menuButtonRef.current?.focus());
      }
    }

    function handlePointerDown(event) {
      if (!menuRootRef.current?.contains(event.target)) closeMenu();
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") closeMenu({ restoreFocus: true });
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.requestAnimationFrame(() => {
      menuPanelRef.current?.querySelector("a, button")?.focus();
    });

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileMenuOpen]);

  function navigationLinks(className, onNavigate) {
    return links.map(({ href, label, icon, badgeCount = 0 }) => {
      const active = isActivePath(pathname, href);
      return (
        <Link
          key={href}
          className={`${className} ${active ? "is-active" : ""} ${badgeCount > 0 ? "has-admin-action" : ""}`}
          href={href}
          aria-current={active ? "page" : undefined}
          onClick={onNavigate}
        >
          <IconText icon={icon} badgeCount={badgeCount}>{label}</IconText>
        </Link>
      );
    });
  }

  return (
    <div className="header-actions" ref={menuRootRef}>
      {showPrivateNav ? <HeaderProgressBadge summary={gamificationSummary} /> : null}

      {showPrivateNav || showLogout ? (
        <button
          className="header-mobile-menu-button"
          ref={menuButtonRef}
          type="button"
          aria-haspopup="true"
          aria-expanded={mobileMenuOpen}
          aria-controls="app-mobile-navigation"
          onClick={() => setMobileMenuOpen((current) => !current)}
        >
          <Menu aria-hidden="true" size={21} strokeWidth={2.2} />
          <span>Meniu</span>
          {adminActionCount > 0 ? <span className="nav-action-badge">{adminActionCount}</span> : null}
        </button>
      ) : null}

      {mobileMenuOpen ? (
        <section
          id="app-mobile-navigation"
          className="header-mobile-menu-panel"
          ref={menuPanelRef}
          aria-label="Meniu principal"
        >
          {showPrivateNav ? (
            <nav className="header-mobile-menu-links" aria-label="Navigare principala">
              {navigationLinks("header-mobile-menu-link", () => setMobileMenuOpen(false))}
            </nav>
          ) : null}

          {showLogout ? (
            <form className="header-mobile-logout-form" action="/auth/signout" method="post">
              <button className="header-mobile-logout-button" type="submit">
                <IconText icon={LogOut}>{logoutLabel}</IconText>
              </button>
            </form>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
