import { StatusPill } from "@/components/ui/status";

import "./admin-table-meta.module.css";

const STATUS_TONES = {
  good: "success",
  warning: "warning",
  bad: "danger",
  default: "neutral"
};

export function AdminStatusPill({ children, tone = "default", className = "" }) {
  return (
    <StatusPill
      tone={STATUS_TONES[tone] || STATUS_TONES.default}
      className={className}
    >
      {children}
    </StatusPill>
  );
}

export function AdminReviewDot({ show, label = "De verificat" }) {
  if (!show) return null;
  return <span className="admin-review-dot" title={label} aria-label={label} />;
}
