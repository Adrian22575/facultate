"use client";

import { ArrowUpDown, ChevronDown, Search, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { LoadingSpinner } from "@/components/loading-spinner";
import { Button } from "@/components/ui/action";

import styles from "./collection-controls.module.css";

const TOOLBAR_LAYOUT_CLASSES = {
  two: styles.toolbarTwo,
  three: styles.toolbarThree,
  four: ""
};

function joinClassNames(...values) {
  return values.filter(Boolean).join(" ");
}

export function FiltersToolbar({
  children,
  className = "",
  layout = "four",
  ariaLabel = "Cautare si filtrare"
}) {
  return (
    <div
      className={joinClassNames(
        styles.toolbar,
        TOOLBAR_LAYOUT_CLASSES[layout] || TOOLBAR_LAYOUT_CLASSES.four,
        className
      )}
      role="group"
      aria-label={ariaLabel}
    >
      {children}
    </div>
  );
}

export function FilterSearch({
  value,
  onChange,
  placeholder,
  ariaLabel = placeholder,
  clearable = false,
  onClear,
  loading = false,
  compact = false,
  className = "",
  inputProps = {}
}) {
  return (
    <label className={joinClassNames(styles.search, compact && styles.compact, className)}>
      <span className={styles.controlIcon} aria-hidden="true">
        {loading ? (
          <LoadingSpinner size={compact ? 16 : 18} />
        ) : (
          <Search size={compact ? 16 : 18} strokeWidth={2.2} />
        )}
      </span>
      <span className="sr-only">{ariaLabel}</span>
      <input
        {...inputProps}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
      />
      {clearable && value ? (
        <button
          type="button"
          className={styles.searchClear}
          aria-label="Sterge cautarea"
          onClick={() => (onClear ? onClear() : onChange(""))}
        >
          <X size={15} aria-hidden="true" />
        </button>
      ) : null}
    </label>
  );
}

export function FilterSelect({
  label,
  value,
  options,
  onChange,
  icon: Icon,
  ariaLabel,
  compact = false,
  disabled = false,
  dataUsageEvent,
  clearable = false,
  clearValue = "all",
  onClear,
  clearLabel,
  className = ""
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const optionRefs = useRef([]);
  const listboxId = useId();
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value)
  );
  const selectedOption = options[selectedIndex] || options[0];

  useEffect(() => {
    if (!open) return undefined;

    function handlePointerDown(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }

    function handleKeyDown(event) {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function openAndFocus(index = selectedIndex) {
    setOpen(true);
    window.requestAnimationFrame(() => optionRefs.current[index]?.focus());
  }

  function handleTriggerKeyDown(event) {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const targetIndex =
      event.key === "ArrowUp" || event.key === "End" ? options.length - 1 : 0;
    openAndFocus(open ? selectedIndex : targetIndex);
  }

  function handleOptionKeyDown(event, index) {
    let nextIndex = index;
    if (event.key === "ArrowDown") nextIndex = Math.min(options.length - 1, index + 1);
    else if (event.key === "ArrowUp") nextIndex = Math.max(0, index - 1);
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = options.length - 1;
    else return;

    event.preventDefault();
    optionRefs.current[nextIndex]?.focus();
  }

  function selectOption(option) {
    onChange(option.value);
    setOpen(false);
    triggerRef.current?.focus();
  }

  return (
    <div
      ref={rootRef}
      className={joinClassNames(
        styles.select,
        compact && styles.compact,
        clearable && value !== clearValue && styles.clearable,
        open && styles.open,
        className
      )}
    >
      <button
        ref={triggerRef}
        type="button"
        className={styles.selectTrigger}
        aria-label={ariaLabel || `${label}: ${selectedOption?.label || ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        disabled={disabled}
        onClick={() => {
          if (open) setOpen(false);
          else openAndFocus();
        }}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className={styles.controlIcon} aria-hidden="true">
          {Icon ? <Icon size={compact ? 16 : 18} strokeWidth={2.1} /> : null}
        </span>
        <span className={styles.selectCopy}>
          <small>{label}</small>
          <strong>{selectedOption?.label}</strong>
        </span>
        <ChevronDown className={styles.selectChevron} size={17} aria-hidden="true" />
      </button>

      {open ? (
        <div id={listboxId} className={styles.selectMenu} role="listbox" aria-label={label}>
          {options.map((option, index) => (
            <button
              key={option.value}
              ref={(node) => {
                optionRefs.current[index] = node;
              }}
              type="button"
              data-usage-event={dataUsageEvent}
              role="option"
              aria-selected={option.value === value}
              className={option.value === value ? styles.selected : ""}
              onClick={() => selectOption(option)}
              onKeyDown={(event) => handleOptionKeyDown(event, index)}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
      {clearable && value !== clearValue ? (
        <button
          type="button"
          className={styles.selectClear}
          aria-label={clearLabel || `Elimina filtrul ${label}`}
          onClick={() => {
            (onClear || (() => onChange(clearValue)))();
            triggerRef.current?.focus();
          }}
        >
          <X size={15} strokeWidth={2.3} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

export function FilterSortSelect(props) {
  return <FilterSelect icon={ArrowUpDown} label="Sorteaza" {...props} />;
}

export function ResultsSummary({ as: Component = "p", className = "", children, ...props }) {
  return (
    <Component {...props} className={className} aria-live={props["aria-live"] || "polite"}>
      {children}
    </Component>
  );
}

export function Pagination({
  page,
  totalPages,
  onPageChange,
  previousLabel = "Inapoi",
  nextLabel = "Inainte",
  ariaLabel = "Paginare rezultate",
  className = ""
}) {
  const normalizedTotalPages = Math.max(1, Number(totalPages) || 1);
  const normalizedPage = Math.min(Math.max(1, Number(page) || 1), normalizedTotalPages);

  if (normalizedTotalPages <= 1) {
    return null;
  }

  function changePage(nextPage) {
    onPageChange(Math.min(Math.max(1, nextPage), normalizedTotalPages));
  }

  return (
    <nav className={joinClassNames(styles.pagination, className)} aria-label={ariaLabel}>
      <Button
        variant="secondary"
        size="compact"
        className={styles.paginationButton}
        onClick={() => changePage(normalizedPage - 1)}
        disabled={normalizedPage <= 1}
      >
        {previousLabel}
      </Button>
      <span className={styles.paginationLabel} aria-live="polite" aria-atomic="true">
        {`Pagina ${normalizedPage} din ${normalizedTotalPages}`}
      </span>
      <Button
        variant="secondary"
        size="compact"
        className={styles.paginationButton}
        onClick={() => changePage(normalizedPage + 1)}
        disabled={normalizedPage >= normalizedTotalPages}
      >
        {nextLabel}
      </Button>
    </nav>
  );
}
