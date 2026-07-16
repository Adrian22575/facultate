"use client";

import Link from "next/link";
import { Crown, Upload } from "lucide-react";

function formatPremiumDate(value) {
  if (!value) {
    return "";
  }

  try {
    return new Intl.DateTimeFormat("ro-RO", {
      day: "2-digit",
      month: "short"
    }).format(new Date(value));
  } catch {
    return "";
  }
}

function HeaderCreditPill({ href, icon: Icon, label, value, detail, tone = "" }) {
  return (
    <Link className={`header-credit-pill ${tone}`} href={href}>
      <span className="header-credit-icon">
        <Icon aria-hidden="true" size={15} strokeWidth={2.3} />
      </span>
      <span className="header-credit-copy">
        <span>{label}</span>
        <strong>{value}</strong>
      </span>
      {detail ? <span className="header-credit-detail">{detail}</span> : null}
    </Link>
  );
}

export function HeaderCreditStatus({ billingSnapshot }) {
  if (!billingSnapshot) {
    return null;
  }

  const aiCredits = Number(billingSnapshot.aiCredits || 0);
  const premiumDate = formatPremiumDate(billingSnapshot.premiumEndsAt);
  const accessActive = Boolean(billingSnapshot.activePremium);
  const accessDetail = accessActive && premiumDate ? `până la ${premiumDate}` : "";

  return (
    <div className="header-credit-status" aria-label="Status acces și încărcări">
      <HeaderCreditPill
        href="/cont?section=plans"
        icon={Crown}
        label="Acces"
        value={accessActive ? "Activ" : "Inactiv"}
        detail={accessDetail}
        tone={accessActive ? "is-active" : "is-muted"}
      />
      <HeaderCreditPill
        href="/cont?section=credits"
        icon={Upload}
        label="Încărcări"
        value={String(aiCredits)}
        detail={aiCredits === 1 ? "disponibilă" : "disponibile"}
        tone={aiCredits > 0 ? "is-active" : "is-warning"}
      />
    </div>
  );
}
