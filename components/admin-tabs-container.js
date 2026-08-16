"use client";

import { moduleClassNames } from "@/lib/ui/module-class-names";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/action";

import tabsStyles from "./admin-tabs-container.module.css";

export function AdminFilterButton({
  active,
  onClick,
  children,
  icon: Icon = null,
  count = null,
  actionCount = 0
}) {
  return (
    <Button
      variant="secondary"
      size="compact"
      aria-pressed={active}
      className={moduleClassNames(tabsStyles, `admin-filter-chip ${active ? "is-active-filter" : ""} ${actionCount > 0 ? "has-admin-action" : ""}`)}
      onClick={onClick}
    >
      <span className={moduleClassNames(tabsStyles, "admin-tab-content")}>
        {Icon ? <Icon className={moduleClassNames(tabsStyles, "admin-tab-icon")} aria-hidden="true" size={15} strokeWidth={2.2} /> : null}
        <span className={moduleClassNames(tabsStyles, "admin-tab-label")}>{children}</span>
        {Number.isFinite(count) ? <span className={moduleClassNames(tabsStyles, "admin-tab-count")}>{count}</span> : null}
        {actionCount > 0 ? <span className={moduleClassNames(tabsStyles, "admin-tab-action-count")}>{actionCount}</span> : null}
      </span>
    </Button>
  );
}

export function AdminTabsContainer({ children, className = "", ...props }) {
  const ref = useRef(null);
  const [isWrapped, setIsWrapped] = useState(false);

  useEffect(() => {
    const node = ref.current;

    if (!node) {
      return undefined;
    }

    function updateWrappedState() {
      const items = Array.from(node.children);
      const firstItem = items[0];

      if (!firstItem) {
        setIsWrapped(false);
        return;
      }

      const firstTop = firstItem.offsetTop;
      setIsWrapped(items.some((item) => item.offsetTop > firstTop + 2));
    }

    updateWrappedState();

    const observer = new ResizeObserver(updateWrappedState);
    observer.observe(node);
    Array.from(node.children).forEach((item) => observer.observe(item));
    window.addEventListener("resize", updateWrappedState);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateWrappedState);
    };
  }, [children]);

  return (
    <div
      ref={ref}
      className={moduleClassNames(tabsStyles, `account-billing-tabs admin-tabs-container ${isWrapped ? "is-wrapped" : "is-single-row"} ${className}`.trim())}
      {...props}
    >
      {children}
    </div>
  );
}
