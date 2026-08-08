"use client";

import { useState } from "react";

import { handleTablistKeyDown } from "@/lib/ui/tablist";
import { InlineFeedback } from "./ui/status";
import styles from "./account-billing-tabs-client.module.css";

function joinClassNames(...values) {
  return values.filter(Boolean).join(" ");
}

export function AccountBillingTabsClient({
  initialSection = "plans",
  checkoutConfigured = true,
  checkoutError = null,
  plansContent,
  creditsContent
}) {
  const [section, setSection] = useState(initialSection === "credits" ? "credits" : "plans");

  return (
    <>
      <div
        className={styles["account-billing-tabs"]}
        role="tablist"
        aria-label="Acces și încărcări"
        onKeyDown={handleTablistKeyDown}
      >
        <button
          id="account-tab-plans"
          type="button"
          role="tab"
          aria-selected={section === "plans"}
          aria-controls="account-billing-panel"
          tabIndex={section === "plans" ? 0 : -1}
          className={joinClassNames(
            styles["account-billing-tab"],
            section === "plans" && styles["is-active"]
          )}
          onClick={() => setSection("plans")}
        >
          Plan de studiu
        </button>
        <button
          id="account-tab-credits"
          type="button"
          role="tab"
          aria-selected={section === "credits"}
          aria-controls="account-billing-panel"
          tabIndex={section === "credits" ? 0 : -1}
          className={joinClassNames(
            styles["account-billing-tab"],
            section === "credits" && styles["is-active"]
          )}
          onClick={() => setSection("credits")}
        >
          Încărcări
        </button>
      </div>

      {!checkoutConfigured ? (
        <InlineFeedback tone="error" role="alert">Plata nu este disponibila momentan. Incearca mai tarziu.</InlineFeedback>
      ) : null}

      {checkoutError ? <InlineFeedback tone="error" role="alert">{checkoutError}</InlineFeedback> : null}

      <div
        id="account-billing-panel"
        className={styles["account-billing-panel"]}
        role="tabpanel"
        aria-labelledby={`account-tab-${section}`}
      >
        {section === "plans" ? plansContent : creditsContent}
      </div>
    </>
  );
}
