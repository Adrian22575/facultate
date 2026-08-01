import Link from "next/link";
import { forwardRef } from "react";

import styles from "./action.module.css";

const VARIANT_CLASSES = {
  primary: styles.primary,
  secondary: styles.secondary,
  text: styles.text,
  destructive: styles.destructive
};

const SIZE_CLASSES = {
  default: styles.defaultSize,
  compact: styles.compact,
  icon: styles.icon
};

function joinClassNames(...values) {
  return values.filter(Boolean).join(" ");
}

function actionClassName({ variant, size, fullWidth, className }) {
  return joinClassNames(
    styles.action,
    VARIANT_CLASSES[variant] || VARIANT_CLASSES.primary,
    SIZE_CLASSES[size] || SIZE_CLASSES.default,
    fullWidth && styles.fullWidth,
    className
  );
}

export const Button = forwardRef(function Button(
  {
    variant = "primary",
    size = "default",
    fullWidth = false,
    className = "",
    type = "button",
    ...props
  },
  ref
) {
  return (
    <button
      {...props}
      ref={ref}
      type={type}
      className={actionClassName({ variant, size, fullWidth, className })}
    />
  );
});

export const ActionLink = forwardRef(function ActionLink(
  {
    as: Component = Link,
    variant = "primary",
    size = "default",
    fullWidth = false,
    className = "",
    ...props
  },
  ref
) {
  return (
    <Component
      {...props}
      ref={ref}
      className={actionClassName({ variant, size, fullWidth, className })}
    />
  );
});
