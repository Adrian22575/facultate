"use client";

export function LoadingSpinner({ size = 16, className = "" }) {
  const resolvedClassName = className
    .split(" ")
    .filter((name) => name && name !== "is-spinning")
    .join(" ");

  return (
    <span
      className={`ui-loading-spinner${resolvedClassName ? ` ${resolvedClassName}` : ""}`}
      aria-hidden="true"
      style={{ "--ui-loading-spinner-size": `${size}px` }}
    >
      <svg viewBox="0 0 24 24" focusable="false">
        <circle className="ui-loading-spinner-track" cx="12" cy="12" r="9" />
        <path className="ui-loading-spinner-ring" d="M21 12a9 9 0 0 1-9 9" />
      </svg>
    </span>
  );
}

export function LoadingIconText({ loading, icon: Icon, children, loadingLabel }) {
  return (
    <span className="ui-icon-text">
      {loading ? (
        <LoadingSpinner />
      ) : Icon ? (
        <Icon aria-hidden="true" size={16} strokeWidth={2.2} />
      ) : null}
      <span>{loading ? loadingLabel || children : children}</span>
    </span>
  );
}
