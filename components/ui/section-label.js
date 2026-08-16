import styles from "./section-label.module.css";

const VARIANTS = {
  default: styles.label,
  eyebrow: styles.eyebrow,
  kicker: styles.kicker
};

export function SectionLabel({ as: Component = "span", variant = "default", className = "", children, ...props }) {
  return (
    <Component {...props} className={[VARIANTS[variant] || VARIANTS.default, className].filter(Boolean).join(" ")}>
      {children}
    </Component>
  );
}
