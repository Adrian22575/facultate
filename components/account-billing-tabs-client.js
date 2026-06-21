"use client";

import { useState } from "react";

import { handleTablistKeyDown } from "@/lib/ui/tablist";

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
        className="ui-segmented-tabs account-billing-tabs"
        role="tablist"
        aria-label="Optiuni cont"
        onKeyDown={handleTablistKeyDown}
      >
        <button
          id="account-tab-plans"
          type="button"
          role="tab"
          aria-selected={section === "plans"}
          aria-controls="account-billing-panel"
          tabIndex={section === "plans" ? 0 : -1}
          className={`ui-segmented-tab secondary account-billing-tab ${
            section === "plans" ? "is-active" : ""
          }`}
          onClick={() => setSection("plans")}
        >
          Schimba planul
        </button>
        <button
          id="account-tab-credits"
          type="button"
          role="tab"
          aria-selected={section === "credits"}
          aria-controls="account-billing-panel"
          tabIndex={section === "credits" ? 0 : -1}
          className={`ui-segmented-tab secondary account-billing-tab ${
            section === "credits" ? "is-active" : ""
          }`}
          onClick={() => setSection("credits")}
        >
          Incarca materiale
        </button>
      </div>

      {!checkoutConfigured ? (
        <div className="error-state" role="alert">Plata nu este disponibila momentan. Incearca mai tarziu.</div>
      ) : null}

      {checkoutError ? <div className="error-state" role="alert">{checkoutError}</div> : null}

      <div
        id="account-billing-panel"
        className="account-billing-panel"
        role="tabpanel"
        aria-labelledby={`account-tab-${section}`}
      >
        {section === "plans" ? plansContent : creditsContent}
      </div>
    </>
  );
}
