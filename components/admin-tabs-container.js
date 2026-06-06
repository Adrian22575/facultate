"use client";

import { useEffect, useRef, useState } from "react";

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
      className={`account-billing-tabs admin-tabs-container ${isWrapped ? "is-wrapped" : "is-single-row"} ${className}`.trim()}
      {...props}
    >
      {children}
    </div>
  );
}
