import styles from "./data-table.module.css";

function joinClassNames(...classNames) {
  return classNames.filter(Boolean).join(" ");
}

const CELL_KINDS = {
  text: styles.cellText,
  name: styles.cellName,
  code: styles.cellCode,
  date: styles.cellDate,
  count: styles.cellCount,
  link: styles.cellLink
};

const CELL_WIDTHS = {
  wide: styles.cellWide,
  xl: styles.cellXl,
  xxl: styles.cellXxl
};

export function DataTableCell({
  as: Component = "td",
  kind = "text",
  width,
  align,
  className = "",
  ...props
}) {
  return (
    <Component
      {...props}
      data-table-align={align === "center" ? "center" : props["data-table-align"]}
      className={joinClassNames(CELL_KINDS[kind], CELL_WIDTHS[width], className)}
    />
  );
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
