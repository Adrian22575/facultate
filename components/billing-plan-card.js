import { ShoppingCart } from "lucide-react";

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
  icon = null,
  returnTo = ""
}) {
  return (
    <article className={`plan-card account-price-card ${featured ? "is-featured" : ""}`}>
      {badge ? <span className="account-price-badge">{badge}</span> : null}

      <div className="account-price-head">
        {icon ? <span className="account-price-icon">{icon}</span> : null}
        <div className="account-price-copy">
          <h3>{plan.name}</h3>
          <p>{description ?? plan.description}</p>
        </div>
      </div>

      {comparisonText ? <p className="account-price-compare">{comparisonText}</p> : null}

      <div className="plan-price account-price-value">
        <strong>{(plan.amount / 100).toFixed(0)}</strong>
        <span>lei</span>
      </div>

      <form action="/api/stripe/checkout" method="post" className="plan-card-form account-price-form">
        <input type="hidden" name="planCode" value={plan.code} />
        {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
        <button type="submit" disabled={disabled}>
          <IconText icon={ShoppingCart}>{ctaLabel}</IconText>
        </button>
      </form>
    </article>
  );
}
