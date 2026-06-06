"use client";

import { useState } from "react";

export function WorkspaceMainTabsClient({
  uploadContent,
  activityContent,
  initialTab = "upload",
  activityCount = 0
}) {
  const [activeTab, setActiveTab] = useState(initialTab === "activity" ? "activity" : "upload");

  return (
    <section className="ai-workspace-main-tabs">
      <div className="ui-segmented-tabs ai-workspace-main-tabs-nav" role="tablist" aria-label="Sectiuni workspace">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "upload"}
          className={`ui-segmented-tab secondary ai-workspace-main-tab ${
            activeTab === "upload" ? "is-active" : ""
          }`}
          onClick={() => setActiveTab("upload")}
        >
          Incarcare
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "activity"}
          className={`ui-segmented-tab secondary ai-workspace-main-tab ${
            activeTab === "activity" ? "is-active" : ""
          }`}
          onClick={() => setActiveTab("activity")}
        >
          <span>Activitate</span>
          {activityCount > 0 ? <span className="ai-workspace-main-tab-count">{activityCount}</span> : null}
        </button>
      </div>

      <div className="ai-workspace-main-tab-panel" role="tabpanel">
        {activeTab === "upload" ? uploadContent : activityContent}
      </div>
    </section>
  );
}
