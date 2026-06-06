"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Database, ServerCog } from "lucide-react";
import { AdminTabsContainer } from "@/components/admin-tabs-container";
import { markAdminNotificationViewed } from "@/lib/admin-notification-client";
import { ADMIN_NOTIFICATION_SCOPES } from "@/lib/admin-notification-scopes";

function normalizeTab(value) {
  if (value === "processing" || value === "openai") {
    return "processing";
  }

  if (value === "uploads") {
    return "uploads";
  }

  return "platform";
}

function readTabFromUrl() {
  if (typeof window === "undefined") {
    return "platform";
  }

  const params = new URLSearchParams(window.location.search);
  return normalizeTab(params.get("admin_tab"));
}

function writeTabToUrl(tab) {
  if (typeof window === "undefined") {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  if (tab === "platform") {
    params.delete("admin_tab");
  } else {
    params.set("admin_tab", tab);
  }

  const query = params.toString();
  const nextUrl = query ? `/admin?${query}` : "/admin";
  window.history.replaceState(window.history.state, "", nextUrl);
}

function AdminTabContent({ icon: Icon, label, count, actionCount = 0 }) {
  return (
    <span className="admin-tab-content">
      {Icon ? <Icon className="admin-tab-icon" aria-hidden="true" size={16} strokeWidth={2.2} /> : null}
      <span className="admin-tab-label">{label}</span>
      {Number.isFinite(count) ? <span className="admin-tab-count">{count}</span> : null}
      {actionCount > 0 ? <span className="admin-tab-action-count">{actionCount}</span> : null}
    </span>
  );
}

export function AdminMainTabsClient({
  defaultTab = "platform",
  tabCounts = {},
  tabActionCounts = {},
  platformContent,
  openaiContent,
  uploadsContent
}) {
  const [activeTab, setActiveTab] = useState(normalizeTab(defaultTab));
  const [visibleActionCounts, setVisibleActionCounts] = useState(tabActionCounts);

  useEffect(() => {
    setActiveTab(readTabFromUrl());
  }, []);

  useEffect(() => {
    setVisibleActionCounts(tabActionCounts);
  }, [tabActionCounts]);

  useEffect(() => {
    function syncFromHistory() {
      setActiveTab(readTabFromUrl());
    }

    window.addEventListener("popstate", syncFromHistory);
    return () => {
      window.removeEventListener("popstate", syncFromHistory);
    };
  }, []);

  function switchTab(nextTab) {
    const normalized = normalizeTab(nextTab);
    setActiveTab(normalized);
    writeTabToUrl(normalized);
  }

  useEffect(() => {
    const scope = ADMIN_NOTIFICATION_SCOPES[activeTab];

    if (!scope || !(visibleActionCounts[activeTab] > 0)) {
      return;
    }

    setVisibleActionCounts((current) => ({
      ...current,
      [activeTab]: 0
    }));
    markAdminNotificationViewed(scope).catch(() => {});
  }, [activeTab, visibleActionCounts]);

  return (
    <div className="admin-main-tabs-shell">
      <section className="surface admin-main-tabs-surface">
        <AdminTabsContainer role="tablist" aria-label="Sectiuni principale admin">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "platform"}
            className={`btn-link secondary admin-main-tab ${activeTab === "platform" ? "is-active-filter" : ""} ${visibleActionCounts.platform > 0 ? "has-admin-action" : ""}`}
            onClick={() => switchTab("platform")}
          >
            <AdminTabContent icon={Database} label="Date platforma" count={tabCounts.platform} actionCount={visibleActionCounts.platform} />
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "processing"}
            className={`btn-link secondary admin-main-tab ${activeTab === "processing" ? "is-active-filter" : ""} ${visibleActionCounts.processing > 0 ? "has-admin-action" : ""}`}
            onClick={() => switchTab("processing")}
          >
            <AdminTabContent icon={ServerCog} label="Loguri procesare" count={tabCounts.processing} actionCount={visibleActionCounts.processing} />
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "uploads"}
            className={`btn-link secondary admin-main-tab ${activeTab === "uploads" ? "is-active-filter" : ""} ${visibleActionCounts.uploads > 0 ? "has-admin-action" : ""}`}
            onClick={() => switchTab("uploads")}
          >
            <AdminTabContent icon={AlertTriangle} label="Upload-uri cu erori" count={tabCounts.uploads} actionCount={visibleActionCounts.uploads} />
          </button>
        </AdminTabsContainer>
      </section>

      <div
        className="admin-main-tab-panel"
        aria-hidden={activeTab !== "platform"}
        hidden={activeTab !== "platform"}
      >
        {platformContent}
      </div>
      <div
        className="admin-main-tab-panel"
        aria-hidden={activeTab !== "processing"}
        hidden={activeTab !== "processing"}
      >
        {openaiContent}
      </div>
      <div
        className="admin-main-tab-panel"
        aria-hidden={activeTab !== "uploads"}
        hidden={activeTab !== "uploads"}
      >
        {uploadsContent}
      </div>
    </div>
  );
}
