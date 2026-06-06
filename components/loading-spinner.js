"use client";

export function LoadingSpinner({ size = 16, className = "" }) {
  return (
    <svg
      className={`ui-loading-spinner${className ? ` ${className}` : ""}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <circle className="ui-loading-spinner-track" cx="12" cy="12" r="9" />
      <path className="ui-loading-spinner-ring" d="M21 12a9 9 0 0 1-9 9" />
    </svg>
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
