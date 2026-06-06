"use client";

import Link from "next/link";
import { cloneElement, isValidElement, useMemo, useState } from "react";

function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getSearchScore(item, normalizedSearch) {
  const normalizedTitle = normalizeSearchText(item.title);
  const normalizedSubtitle = normalizeSearchText(item.subtitle);
  const normalizedHaystack = [normalizedTitle, normalizedSubtitle].filter(Boolean).join(" ");

  if (!normalizedHaystack.includes(normalizedSearch)) {
    return -1;
  }

  if (normalizedTitle === normalizedSearch) {
    return 0;
  }

  if (normalizedTitle.startsWith(normalizedSearch)) {
    return 1;
  }

  if (normalizedHaystack.split(" ").some((word) => word.startsWith(normalizedSearch))) {
    return 2;
  }

  return 3;
}

export function OnboardingSelectionStep({
  searchPlaceholder,
  items,
  emptyMessage,
  addButtonLabel,
  addPanel,
  limit = 10
}) {
  const [query, setQuery] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const hasItems = items.length > 0;
  const normalizedQuery = query.trim();
  const canAddItems = Boolean(addButtonLabel && addPanel);
  const showSearch = hasItems || canAddItems;

  const matchingItems = useMemo(() => {
    const normalizedSearch = normalizeSearchText(query);

    if (!normalizedSearch) {
      return items;
    }

    return items
      .map((item, index) => ({
        item,
        index,
        score: getSearchScore(item, normalizedSearch)
      }))
      .filter(({ score }) => score >= 0)
      .sort((left, right) => {
        if (left.score !== right.score) {
          return left.score - right.score;
        }

        return left.index - right.index;
      })
      .map(({ item }) => item)
  }, [items, query]);

  const filteredItems = matchingItems.slice(0, limit);
  const totalMatchingItems = matchingItems.length;
  const hasNoMatches = filteredItems.length === 0;
  const canAddSearchedValue = canAddItems && normalizedQuery && hasNoMatches;
  const addPanelWithDefaults =
    isValidElement(addPanel) && normalizedQuery
      ? cloneElement(addPanel, {
          fieldDefaults: {
            name: normalizedQuery
          }
        })
      : addPanel;
  const visibleCountLabel = normalizedQuery
    ? totalMatchingItems > limit
      ? `Primele ${limit} din ${totalMatchingItems} rezultate`
      : totalMatchingItems === 1
      ? "1 rezultat gasit"
      : `${totalMatchingItems} rezultate gasite`
    : hasItems
      ? items.length > limit
        ? `Primele ${limit} din ${items.length} optiuni`
        : `${items.length} optiuni disponibile`
      : canAddItems
        ? "Scrie numele si il poti adauga imediat."
      : "";
  const resolvedAddButtonLabel =
    canAddSearchedValue
      ? `Adauga "${normalizedQuery}"`
      : hasNoMatches && hasItems
        ? "Nu gasesti ce cauti? Adauga"
        : addButtonLabel;
  const resolvedEmptyMessage =
    canAddSearchedValue
      ? (
        <>
          <strong>Nu am gasit "{normalizedQuery}".</strong>
          <span>Il poti adauga acum si continui imediat cu pasul urmator.</span>
        </>
      )
      : emptyMessage;

  return (
    <div className="onboarding-step-body">
      {!isAdding ? (
        <>
          {showSearch ? (
            <div className="ai-form">
              <div className="onboarding-search-row">
                <input
                  className="input-search"
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={searchPlaceholder}
                />
                {normalizedQuery ? (
                  <button
                    type="button"
                    className="btn-link secondary onboarding-search-clear"
                    onClick={() => setQuery("")}
                    aria-label="Sterge cautarea"
                  >
                    Sterge
                  </button>
                ) : null}
              </div>
              {visibleCountLabel ? (
                <p className="micro-copy onboarding-search-status" aria-live="polite">
                  {visibleCountLabel}
                </p>
              ) : null}
            </div>
          ) : null}

          {filteredItems.length ? (
            <div className="draft-list onboarding-selection-list">
              {filteredItems.map((item) => (
                <Link
                  key={item.id}
                  className={`test-link onboarding-selection-card ${item.selected ? "primary" : ""}`}
                  href={item.href}
                >
                  <strong>{item.title}</strong>
                  {item.subtitle ? <span>{item.subtitle}</span> : null}
                </Link>
              ))}
            </div>
          ) : (
            <div className="empty-state onboarding-search-empty" role="status">
              {resolvedEmptyMessage}
            </div>
          )}

          {addButtonLabel ? (
            <div className="inline-actions onboarding-actions-row">
              <button className="secondary" type="button" onClick={() => setIsAdding(true)}>
                {resolvedAddButtonLabel}
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <div className="onboarding-add-panel">
          {addPanelWithDefaults}
          <div className="inline-actions onboarding-actions-row">
            <button className="secondary" type="button" onClick={() => setIsAdding(false)}>
              Inapoi la lista
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
