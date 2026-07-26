"use client";

import { ArrowUpDown, ChevronDown, LoaderCircle, Search, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

function joinClassNames(...values) {
  return values.filter(Boolean).join(" ");
}

export function FiltersToolbar({
  children,
  className = "",
  compact = false,
  layout = "auto",
  ariaLabel = "Cautare si filtrare"
}) {
  return (
    <div
      className={joinClassNames(
        "filters-toolbar",
        `filters-toolbar--${layout}`,
        compact && "is-compact",
        className
      )}
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
    <label className={joinClassNames("filter-search", compact && "is-compact", className)}>
      <span className="filter-control-icon" aria-hidden="true">
        {loading ? (
          <LoaderCircle className="is-spinning" size={compact ? 16 : 18} strokeWidth={2.2} />
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
          className="filter-search-clear"
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
        "filter-select",
        compact && "is-compact",
        open && "is-open",
        className
      )}
    >
      <button
        ref={triggerRef}
        type="button"
        className="filter-select-trigger"
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
        <span className="filter-control-icon" aria-hidden="true">
          {Icon ? <Icon size={compact ? 16 : 18} strokeWidth={2.1} /> : null}
        </span>
        <span className="filter-select-copy">
          <small>{label}</small>
          <strong>{selectedOption?.label}</strong>
        </span>
        <ChevronDown className="filter-select-chevron" size={17} aria-hidden="true" />
      </button>

      {open ? (
        <div id={listboxId} className="filter-select-menu" role="listbox" aria-label={label}>
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
              className={joinClassNames(
                "filter-select-option",
                option.value === value && "is-selected"
              )}
              onClick={() => selectOption(option)}
              onKeyDown={(event) => handleOptionKeyDown(event, index)}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function FilterSortSelect(props) {
  return <FilterSelect icon={ArrowUpDown} label="Sorteaza" {...props} />;
}
