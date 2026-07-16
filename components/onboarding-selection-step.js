"use client";

import Link from "next/link";
import { cloneElement, isValidElement, useMemo, useState } from "react";
import { ArrowRight, Building2, GraduationCap, Search, School, Sparkles } from "lucide-react";

const SELECTION_VISUALS = {
  institution: { icon: Building2, label: "instituția" },
  faculty: { icon: School, label: "facultatea" },
  program: { icon: GraduationCap, label: "specializarea" },
  profile: { icon: Sparkles, label: "profilul" },
  skip: { icon: ArrowRight, label: "alegerea" }
};

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

  if (normalizedTitle === normalizedSearch) return 0;
  if (normalizedTitle.startsWith(normalizedSearch)) return 1;
  if (normalizedHaystack.split(" ").some((word) => word.startsWith(normalizedSearch))) return 2;
  return 3;
}

export function OnboardingSelectionStep({
  searchPlaceholder,
  items,
  emptyMessage,
  addButtonLabel,
  addPanel,
  limit = 10,
  selectionKind = "institution",
  searchRequired = false
}) {
  const [query, setQuery] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const visual = SELECTION_VISUALS[selectionKind] || SELECTION_VISUALS.institution;
  const PickerIcon = visual.icon;

  const hasItems = items.length > 0;
  const normalizedQuery = query.trim();
  const canAddItems = Boolean(addButtonLabel && addPanel);
  const showSearch = hasItems || canAddItems;
  const hasEnoughSearch = normalizedQuery.length >= (searchRequired ? 2 : 1);
  const shouldShowResults = !searchRequired || hasEnoughSearch;

  const matchingItems = useMemo(() => {
    const normalizedSearch = normalizeSearchText(query);
    if (!normalizedSearch) return items;

    return items
      .map((item, index) => ({ item, index, score: getSearchScore(item, normalizedSearch) }))
      .filter(({ score }) => score >= 0)
      .sort((left, right) => left.score - right.score || left.index - right.index)
      .map(({ item }) => item);
  }, [items, query]);

  const filteredItems = shouldShowResults ? matchingItems.slice(0, limit) : [];
  const totalMatchingItems = shouldShowResults ? matchingItems.length : 0;
  const hasNoMatches = shouldShowResults && filteredItems.length === 0;
  const canAddSearchedValue = canAddItems && hasEnoughSearch && hasNoMatches;
  const showAddAction = canAddItems && (!searchRequired || hasEnoughSearch || !hasItems);
  const addPanelWithDefaults =
    isValidElement(addPanel) && normalizedQuery
      ? cloneElement(addPanel, { fieldDefaults: { name: normalizedQuery } })
      : addPanel;
  const visibleCountLabel =
    normalizedQuery && shouldShowResults
      ? totalMatchingItems > limit
        ? `Primele ${limit} din ${totalMatchingItems} rezultate`
        : totalMatchingItems === 1
          ? "1 rezultat găsit"
          : `${totalMatchingItems} rezultate găsite`
      : !searchRequired && hasItems
        ? items.length > limit
          ? `Primele ${limit} din ${items.length} opțiuni`
          : `${items.length} opțiuni disponibile`
        : "";
  const resolvedAddButtonLabel =
    canAddSearchedValue
      ? `Adaugă „${normalizedQuery}”`
      : hasNoMatches && hasItems
        ? `Nu găsești ${visual.label}? Adaugă`
        : addButtonLabel;
  const resolvedEmptyMessage = canAddSearchedValue ? (
    <>
      <strong>Nu am găsit „{normalizedQuery}”.</strong>
      <span>O poți adăuga acum și continui imediat.</span>
    </>
  ) : (
    emptyMessage
  );

  return (
    <div className="onboarding-step-body">
      {!isAdding ? (
        <>
          {showSearch ? (
            <div className="onboarding-picker-search">
              <div className="onboarding-search-row">
                <Search aria-hidden="true" size={19} strokeWidth={2.3} />
                <input
                  className="input-search"
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={searchPlaceholder}
                  aria-label={searchPlaceholder}
                  autoComplete="off"
                />
                {normalizedQuery ? (
                  <button
                    type="button"
                    className="btn-link secondary onboarding-search-clear"
                    onClick={() => setQuery("")}
                    aria-label="Șterge căutarea"
                  >
                    Șterge
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

          {searchRequired && !hasEnoughSearch ? (
            <div className="onboarding-search-start" role="status">
              <span className="onboarding-selection-icon" aria-hidden="true">
                <PickerIcon size={20} strokeWidth={2.2} />
              </span>
              <div>
                <strong>Începe cu numele {visual.label}.</strong>
                <span>Scrie cel puțin 2 litere pentru a vedea opțiunile potrivite.</span>
              </div>
            </div>
          ) : filteredItems.length ? (
            <div className="draft-list onboarding-selection-list">
              {filteredItems.map((item) => {
                const ItemIcon = (SELECTION_VISUALS[item.kind || selectionKind] || visual).icon;

                return (
                  <Link
                    key={item.id}
                    className={`test-link onboarding-selection-card ${item.selected ? "primary" : ""}`}
                    href={item.href}
                    aria-current={item.selected ? "true" : undefined}
                  >
                    <span className="onboarding-selection-icon" aria-hidden="true">
                      <ItemIcon size={19} strokeWidth={2.2} />
                    </span>
                    <span className="onboarding-selection-copy">
                      <strong>{item.title}</strong>
                      {item.subtitle ? <span>{item.subtitle}</span> : null}
                    </span>
                    <ArrowRight className="onboarding-selection-arrow" aria-hidden="true" size={18} strokeWidth={2.4} />
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="empty-state onboarding-search-empty" role="status">
              {resolvedEmptyMessage}
            </div>
          )}

          {showAddAction ? (
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
              Înapoi la căutare
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
