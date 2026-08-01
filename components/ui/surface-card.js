import styles from "./surface-card.module.css";

function joinClassNames(...values) {
  return values.filter(Boolean).join(" ");
}

export function SurfaceCard({ as: Component = "section", className = "", ...props }) {
  return <Component {...props} className={joinClassNames(styles.card, className)} />;
}
