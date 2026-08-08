import { ShoppingCart } from "lucide-react";

import { Button } from "./ui/action";
import styles from "./billing-plan-card.module.css";

function joinClassNames(...values) {
  return values.filter(Boolean).join(" ");
}

function IconText({ icon: Icon, children }) {
  return (
    <span className="ui-icon-text">
      <Icon aria-hidden="true" size={16} strokeWidth={2.2} />
      <span>{children}</span>
    </span>
  );
}

export function BillingPlanCard({
  plan,
  ctaLabel = "Cumpara acum",
  disabled = false,
  description,
  comparisonText,
  badge,
  featured = false,
  selected = false,
  icon = null,
  returnTo = ""
}) {
  const checkoutSection = plan.family === "ai_credits" ? "credits" : "plans";

  return (
    <article
      className={joinClassNames(
        styles["account-price-card"],
        (featured || selected) && styles["is-featured"]
      )}
    >
      {selected || badge ? (
        <span className={styles["account-price-badge"]}>{selected ? "Plan ales" : badge}</span>
      ) : null}

      <div className={styles["account-price-head"]}>
        {icon ? <span className={styles["account-price-icon"]}>{icon}</span> : null}
        <div className={styles["account-price-copy"]}>
          <h3>{plan.name}</h3>
          <p>{description ?? plan.description}</p>
        </div>
      </div>

      {comparisonText ? <p className={styles["account-price-compare"]}>{comparisonText}</p> : null}

      <div className={styles["account-price-value"]}>
        <strong>{(plan.amount / 100).toFixed(0)}</strong>
        <span>lei</span>
      </div>

      <form
        action={`/api/stripe/checkout?section=${checkoutSection}`}
        method="post"
        className={styles["account-price-form"]}
      >
        <input type="hidden" name="planCode" value={plan.code} />
        {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
        <Button type="submit" fullWidth disabled={disabled}>
          <IconText icon={ShoppingCart}>{ctaLabel}</IconText>
        </Button>
      </form>
    </article>
  );
}
