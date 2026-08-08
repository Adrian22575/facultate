"use client";

import {
  CheckCircle2,
  ChevronDown,
  Clock3,
  Copy,
  Gift,
  Link2,
  Sparkles,
  UserRoundCheck,
  UsersRound
} from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "./ui/action";
import styles from "./referral-share-card.module.css";

const referralSteps = [
  {
    icon: Link2,
    title: "Copiaza linkul",
    desc: "Primesti un link unic pe care il poti trimite colegilor."
  },
  {
    icon: UsersRound,
    title: "Colegul intra",
    desc: "Cand isi confirma emailul si intra in cont, invitatia devine valida."
  },
  {
    icon: Gift,
    title: "Primesti 24h",
    desc: "Activezi cadoul din contul tau cand invitatia este confirmata."
  }
];

function moduleClassNames(...names) {
  return names.filter(Boolean).map((name) => styles[name]).filter(Boolean).join(" ");
}

function ReferralStep({ icon: Icon, title, desc, isLast = false }) {
  return (
    <div className={moduleClassNames("account-referral-step")}>
      <div className={moduleClassNames("account-referral-step-marker")}>
        <span className={moduleClassNames("account-referral-step-icon")}>
          <Icon aria-hidden="true" size={18} strokeWidth={2.3} />
        </span>
        {!isLast ? <span className={moduleClassNames("account-referral-step-line")} /> : null}
      </div>
      <div className={moduleClassNames("account-referral-step-copy")}>
        <strong>{title}</strong>
        <span>{desc}</span>
      </div>
    </div>
  );
}

function ReferralStat({ icon: Icon, label, value, tone = "" }) {
  return (
    <div className={moduleClassNames("referral-stat", tone)}>
      <span className={moduleClassNames("referral-stat-icon")}>
        <Icon aria-hidden="true" size={16} strokeWidth={2.3} />
      </span>
      <span className={moduleClassNames("referral-stat-label")}>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatReferralDate(value) {
  if (!value) {
    return "Data indisponibila";
  }

  try {
    return new Intl.DateTimeFormat("ro-RO", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(value));
  } catch {
    return "Data indisponibila";
  }
}

function getReferralStatusCopy(status) {
  if (status === "rewarded") {
    return {
      label: "Bonus primit",
      tone: "is-good",
      detail: "Ai activat deja recompensa pentru aceasta invitatie."
    };
  }

  if (status === "ready") {
    return {
      label: "Confirmat",
      tone: "is-ready",
      detail: "Bonusul este gata de activat."
    };
  }

  if (status === "invalid") {
    return {
      label: "Invalid",
      tone: "is-muted",
      detail: "Invitatia nu mai poate aduce recompensa."
    };
  }

  return {
    label: "In asteptare",
    tone: "is-waiting",
    detail: "Colegul apare in lista, dar bonusul devine disponibil dupa ce isi confirma emailul si intra in cont."
  };
}

function ReferralInviteRow({ referral }) {
  const statusCopy = getReferralStatusCopy(referral.status);
  const displayName = referral.name || referral.email || "Colegul invitat";
  const secondary = referral.email && referral.email !== displayName ? referral.email : "Cont creat prin linkul tau";
  const dateLabel =
    referral.status === "rewarded"
      ? `Bonus primit ${formatReferralDate(referral.rewardedAt)}`
      : referral.status === "ready"
        ? `Confirmat ${formatReferralDate(referral.confirmedAt)}`
        : `Intrat ${formatReferralDate(referral.accountCreatedAt || referral.createdAt)}`;

  return (
    <article className={moduleClassNames("account-referral-invite-row")}>
      <div className={moduleClassNames("account-referral-person")}>
        <span className={moduleClassNames("account-referral-person-icon")}>
          <UserRoundCheck aria-hidden="true" size={18} strokeWidth={2.3} />
        </span>
        <div className={moduleClassNames("account-referral-person-copy")}>
          <strong>{displayName}</strong>
          <span>{secondary}</span>
        </div>
      </div>
      <div className={moduleClassNames("account-referral-invite-status")}>
        <span className={moduleClassNames("account-referral-status-pill", statusCopy.tone)}>{statusCopy.label}</span>
        <small>{dateLabel}</small>
      </div>
      <p>{statusCopy.detail}</p>
    </article>
  );
}

export function ReferralShareCard({
  referralPath,
  pendingCount = 0,
  readyCount = 0,
  rewardedCount = 0,
  referrals = [],
  activateAction
}) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const referralUrl = useMemo(() => {
    if (typeof window === "undefined") {
      return referralPath;
    }

    return `${window.location.origin}${referralPath}`;
  }, [referralPath]);

  async function copyReferralLink() {
    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className={moduleClassNames("account-referral-panel", expanded ? "is-expanded" : "is-collapsed")} aria-label="Referral">
      <div className={moduleClassNames("account-referral-teaser")}>
        <div className={moduleClassNames("account-referral-teaser-copy")}>
          <span className={moduleClassNames("account-referral-teaser-kicker")}>
            <Gift aria-hidden="true" size={17} strokeWidth={2.4} />
            Invita colegi
          </span>
          <h2>Vrei 24h gratuite pentru invatat?</h2>
          <p>Trimite linkul tau unui coleg. Cand isi confirma contul, iti pregatim bonusul.</p>
        </div>
        <div className={moduleClassNames("account-referral-teaser-meta")} aria-label="Status invitatii">
          <span>{`${readyCount} confirmate`}</span>
          <span>{`${pendingCount} in asteptare`}</span>
          <span>{`${rewardedCount} primite`}</span>
        </div>
        <Button variant="secondary"
          type="button"
          className={moduleClassNames("account-referral-expand-btn")}
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "Ascunde" : readyCount > 0 ? "Vezi bonusul" : "Vezi linkul"}
          <ChevronDown aria-hidden="true" size={18} strokeWidth={2.4} />
        </Button>
      </div>

      {expanded ? (
        <div className={moduleClassNames("account-referral-body")}>
          <aside className={moduleClassNames("account-referral-timeline")}>
            <p>Cum functioneaza</p>
            <div className={moduleClassNames("account-referral-steps")}>
              {referralSteps.map((step, index) => (
                <ReferralStep
                  key={step.title}
                  icon={step.icon}
                  title={step.title}
                  desc={step.desc}
                  isLast={index === referralSteps.length - 1}
                />
              ))}
            </div>
          </aside>

          <div className={moduleClassNames("account-referral-main")}>
            <div className={moduleClassNames("account-referral-copy")}>
              <span className={moduleClassNames("account-section-label", "account-referral-label")}>Invita colegi</span>
              <h2>Un link simplu care iti aduce timp extra pentru invatat.</h2>
              <p>Trimite linkul colegilor. Cand colegul isi confirma contul, primesti acces extra timp de 24h.</p>
            </div>

            <div className={moduleClassNames("account-referral-linkbox")}>
              <div className={moduleClassNames("account-referral-url")}>
                <Link2 aria-hidden="true" size={18} strokeWidth={2.3} />
                <span>{referralUrl}</span>
              </div>
              <Button variant="secondary" type="button" className={moduleClassNames("account-referral-copy-btn")} onClick={copyReferralLink}>
                {copied ? <CheckCircle2 aria-hidden="true" size={18} /> : <Copy aria-hidden="true" size={18} />}
                {copied ? "Copiat" : "Copiaza"}
              </Button>
            </div>
          </div>

          <div className={moduleClassNames("account-referral-status-zone")}>
            <div className={moduleClassNames("account-referral-reward")}>
              <div className={moduleClassNames("account-referral-reward-copy")}>
                <span className={moduleClassNames("account-referral-reward-icon")}>
                  <Gift aria-hidden="true" size={22} strokeWidth={2.3} />
                </span>
                <div>
                  <span>Recompensa disponibila</span>
                  <strong>24h acces</strong>
                </div>
              </div>
              <Sparkles aria-hidden="true" className={moduleClassNames("account-referral-sparkle")} size={22} strokeWidth={2.3} />
            </div>

            <div className={moduleClassNames("account-referral-rule-note")}>
              <strong>Regula bonusului</strong>
              <span>Cand colegul isi confirma emailul si intra in cont, invitatia devine confirmata. Tu activezi cele 24h cand ai nevoie.</span>
            </div>

            <div className={moduleClassNames("account-referral-stats")} aria-label="Status referral">
              <ReferralStat icon={Clock3} label="In asteptare" value={pendingCount} />
              <ReferralStat icon={CheckCircle2} label="Confirmate" value={readyCount} tone={readyCount ? "is-good" : ""} />
              <ReferralStat icon={Gift} label="24h primite" value={rewardedCount} tone="is-good" />
            </div>

            {readyCount > 0 && activateAction ? (
              <form action={activateAction} className={moduleClassNames("account-referral-activate-form")}>
                <input type="hidden" name="returnTo" value="/cont?section=plans" />
                <Button variant="secondary" type="submit" className={moduleClassNames("account-referral-activate-btn")}>
                  <Gift aria-hidden="true" size={18} strokeWidth={2.3} />
                  Activeaza 24h
                </Button>
              </form>
            ) : null}
          </div>

          <div className={moduleClassNames("account-referral-invites")}>
            <div className={moduleClassNames("account-referral-invites-head")}>
              <div>
                <span className={moduleClassNames("account-section-label", "account-referral-label")}>Invitatiile tale</span>
                <h3>Colegii care au intrat prin linkul tau</h3>
              </div>
              <span>{`${referrals.length} ${referrals.length === 1 ? "invitatie" : "invitatii"}`}</span>
            </div>

            {referrals.length ? (
              <div className={moduleClassNames("account-referral-invite-list")}>
                {referrals.map((referral) => (
                  <ReferralInviteRow key={referral.id} referral={referral} />
                ))}
              </div>
            ) : (
              <div className={moduleClassNames("account-referral-empty")}>
                <strong>Lista este goala momentan.</strong>
                <p>Cand cineva isi face cont folosind linkul tau, apare aici cu statusul invitatiei.</p>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
