import styles from "./section-label.module.css";

export function SectionLabel({ as: Component = "span", className = "", children, ...props }) {
  return (
    <Component {...props} className={[styles.label, className].filter(Boolean).join(" ")}>
      {children}
    </Component>
  );
}
