"use client";

import { useState } from "react";

import { handleTablistKeyDown } from "@/lib/ui/tablist";

export function WorkspaceMainTabsClient({
  uploadContent,
  activityContent,
  initialTab = "upload",
  activityCount = 0
}) {
  const [activeTab, setActiveTab] = useState(initialTab === "activity" ? "activity" : "upload");

  return (
    <section className="ai-workspace-main-tabs">
      <div
        className="ui-segmented-tabs ai-workspace-main-tabs-nav"
        role="tablist"
        aria-label="Sectiuni workspace"
        onKeyDown={handleTablistKeyDown}
      >
        <button
          id="workspace-tab-upload"
          type="button"
          role="tab"
          aria-selected={activeTab === "upload"}
          aria-controls="workspace-main-panel"
          tabIndex={activeTab === "upload" ? 0 : -1}
          className={`ui-segmented-tab secondary ai-workspace-main-tab ${
            activeTab === "upload" ? "is-active" : ""
          }`}
          onClick={() => setActiveTab("upload")}
        >
          Incarcare
        </button>
        <button
          id="workspace-tab-activity"
          type="button"
          role="tab"
          aria-selected={activeTab === "activity"}
          aria-controls="workspace-main-panel"
          tabIndex={activeTab === "activity" ? 0 : -1}
          className={`ui-segmented-tab secondary ai-workspace-main-tab ${
            activeTab === "activity" ? "is-active" : ""
          }`}
          onClick={() => setActiveTab("activity")}
        >
          <span>Activitate</span>
          {activityCount > 0 ? <span className="ai-workspace-main-tab-count">{activityCount}</span> : null}
        </button>
      </div>

      <div
        id="workspace-main-panel"
        className="ai-workspace-main-tab-panel"
        role="tabpanel"
        aria-labelledby={`workspace-tab-${activeTab}`}
      >
        {activeTab === "upload" ? uploadContent : activityContent}
      </div>
    </section>
  );
}
