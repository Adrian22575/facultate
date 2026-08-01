import styles from "./data-table.module.css";

function joinClassNames(...classNames) {
  return classNames.filter(Boolean).join(" ");
}

export function DataTable({
  caption,
  columns,
  children,
  minWidth,
  responsive = "scroll",
  className = "",
  style,
  ...tableProps
}) {
  const tableStyle = Number.isFinite(minWidth)
    ? { ...style, "--data-table-min-width": `${minWidth}px` }
    : style;

  return (
    <div
      className={joinClassNames(
        styles.container,
        responsive === "cards" ? styles.cards : ""
      )}
    >
      <table
        {...tableProps}
        className={joinClassNames(styles.table, className)}
        style={tableStyle}
      >
        <caption className={styles.caption}>{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                aria-label={column.ariaLabel}
                data-table-align={column.align === "center" ? "center" : undefined}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
