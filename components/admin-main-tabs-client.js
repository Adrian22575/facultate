"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, BookText, Database, ServerCog } from "lucide-react";
import { useRouter } from "next/navigation";
import { AdminTabsContainer } from "@/components/admin-tabs-container";
import { markAdminNotificationViewed } from "@/lib/admin-notification-client";
import { ADMIN_NOTIFICATION_SCOPES } from "@/lib/admin-notification-scopes";
import { handleTablistKeyDown } from "@/lib/ui/tablist";

function normalizeTab(value) {
  if (value === "processing" || value === "openai") {
    return "processing";
  }

  if (value === "uploads") {
    return "uploads";
  }

  if (value === "dictionary") {
    return "dictionary";
  }

  return "platform";
}

function getTabUrl(tab) {
  const params = new URLSearchParams(window.location.search);
  if (tab === "platform") {
    params.delete("admin_tab");
  } else {
    params.set("admin_tab", tab);
  }

  const query = params.toString();
  return query ? `/admin?${query}` : "/admin";
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
  uploadsContent,
  dictionaryContent
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(normalizeTab(defaultTab));
  const [visibleActionCounts, setVisibleActionCounts] = useState(tabActionCounts);

  useEffect(() => {
    setActiveTab(normalizeTab(defaultTab));
  }, [defaultTab]);

  useEffect(() => {
    setVisibleActionCounts(tabActionCounts);
  }, [tabActionCounts]);

  function switchTab(nextTab) {
    const normalized = normalizeTab(nextTab);
    if (normalized === activeTab) {
      return;
    }

    setActiveTab(normalized);
    router.push(getTabUrl(normalized), { scroll: false });
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
        <AdminTabsContainer
          role="tablist"
          aria-label="Sectiuni principale admin"
          onKeyDown={handleTablistKeyDown}
        >
          <button
            id="admin-tab-platform"
            type="button"
            role="tab"
            aria-selected={activeTab === "platform"}
            aria-controls="admin-panel-platform"
            tabIndex={activeTab === "platform" ? 0 : -1}
            aria-label="Platformă"
            className={`btn-link secondary admin-main-tab ${activeTab === "platform" ? "is-active-filter" : ""} ${visibleActionCounts.platform > 0 ? "has-admin-action" : ""}`}
            onClick={() => switchTab("platform")}
          >
            <AdminTabContent icon={Database} label="Platformă" count={tabCounts.platform} actionCount={visibleActionCounts.platform} />
          </button>
          <button
            id="admin-tab-processing"
            type="button"
            role="tab"
            aria-selected={activeTab === "processing"}
            aria-controls="admin-panel-processing"
            tabIndex={activeTab === "processing" ? 0 : -1}
            aria-label="Procesări"
            className={`btn-link secondary admin-main-tab ${activeTab === "processing" ? "is-active-filter" : ""} ${visibleActionCounts.processing > 0 ? "has-admin-action" : ""}`}
            onClick={() => switchTab("processing")}
          >
            <AdminTabContent icon={ServerCog} label="Procesări" count={tabCounts.processing} actionCount={visibleActionCounts.processing} />
          </button>
          <button
            id="admin-tab-uploads"
            type="button"
            role="tab"
            aria-selected={activeTab === "uploads"}
            aria-controls="admin-panel-uploads"
            tabIndex={activeTab === "uploads" ? 0 : -1}
            aria-label="Upload-uri cu erori"
            className={`btn-link secondary admin-main-tab ${activeTab === "uploads" ? "is-active-filter" : ""} ${visibleActionCounts.uploads > 0 ? "has-admin-action" : ""}`}
            onClick={() => switchTab("uploads")}
          >
            <AdminTabContent icon={AlertTriangle} label="Upload-uri cu erori" count={tabCounts.uploads} actionCount={visibleActionCounts.uploads} />
          </button>
          <button
            id="admin-tab-dictionary"
            type="button"
            role="tab"
            aria-selected={activeTab === "dictionary"}
            aria-controls="admin-panel-dictionary"
            tabIndex={activeTab === "dictionary" ? 0 : -1}
            aria-label="Dicționar"
            className={`btn-link secondary admin-main-tab ${activeTab === "dictionary" ? "is-active-filter" : ""}`}
            onClick={() => switchTab("dictionary")}
          >
            <AdminTabContent icon={BookText} label="Dicționar" count={tabCounts.dictionary} />
          </button>
        </AdminTabsContainer>
      </section>

      <div
        id="admin-panel-platform"
        className="admin-main-tab-panel"
        role="tabpanel"
        aria-labelledby="admin-tab-platform"
        aria-hidden={activeTab !== "platform"}
        hidden={activeTab !== "platform"}
      >
        {platformContent}
      </div>
      <div
        id="admin-panel-processing"
        className="admin-main-tab-panel"
        role="tabpanel"
        aria-labelledby="admin-tab-processing"
        aria-hidden={activeTab !== "processing"}
        hidden={activeTab !== "processing"}
      >
        {openaiContent}
      </div>
      <div
        id="admin-panel-uploads"
        className="admin-main-tab-panel"
        role="tabpanel"
        aria-labelledby="admin-tab-uploads"
        aria-hidden={activeTab !== "uploads"}
        hidden={activeTab !== "uploads"}
      >
        {uploadsContent}
      </div>
      <div
        id="admin-panel-dictionary"
        className="admin-main-tab-panel"
        role="tabpanel"
        aria-labelledby="admin-tab-dictionary"
        aria-hidden={activeTab !== "dictionary"}
        hidden={activeTab !== "dictionary"}
      >
        {dictionaryContent}
      </div>
    </div>
  );
}
