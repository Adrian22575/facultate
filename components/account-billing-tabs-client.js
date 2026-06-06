"use client";

import { useState } from "react";

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
      <div className="ui-segmented-tabs account-billing-tabs" role="tablist" aria-label="Optiuni cont">
        <button
          type="button"
          role="tab"
          aria-selected={section === "plans"}
          className={`ui-segmented-tab secondary account-billing-tab ${
            section === "plans" ? "is-active" : ""
          }`}
          onClick={() => setSection("plans")}
        >
          Schimba planul
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={section === "credits"}
          className={`ui-segmented-tab secondary account-billing-tab ${
            section === "credits" ? "is-active" : ""
          }`}
          onClick={() => setSection("credits")}
        >
          Incarca materiale
        </button>
      </div>

      {!checkoutConfigured ? (
        <div className="error-state">Plata nu este disponibila momentan. Incearca mai tarziu.</div>
      ) : null}

      {checkoutError ? <div className="error-state">{checkoutError}</div> : null}

      <div className="account-billing-panel" role="tabpanel">
        {section === "plans" ? plansContent : creditsContent}
      </div>
    </>
  );
}
