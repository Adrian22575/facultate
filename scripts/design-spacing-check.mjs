import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const globalCssEntries = [
  {
    relativePath: "app/styles/foundations/tokens.css",
    importPath: "./styles/foundations/tokens.css"
  },
  {
    relativePath: "app/styles/foundations/reset.css",
    importPath: "./styles/foundations/reset.css"
  },
  {
    relativePath: "app/styles/foundations/accessibility.css",
    importPath: "./styles/foundations/accessibility.css"
  },
  {
    relativePath: "app/styles/shell/app-shell.css",
    importPath: "./styles/shell/app-shell.css"
  },
  {
    relativePath: "app/styles/shell/navigation.css",
    importPath: "./styles/shell/navigation.css"
  },
  {
    relativePath: "app/globals.css",
    importPath: "./globals.css"
  }
];
const primitiveCssEntries = [
  "components/ui/action.module.css",
  "components/ui/form-field.module.css",
  "components/ui/status.module.css",
  "components/ui/surface-card.module.css",
  "components/ui/state.module.css",
  "components/ui/collection-controls.module.css",
  "components/ui/data-table.module.css"
];
const colocatedCssEntries = [
  { relativePath: "components/free-tools-page.module.css", importantCeiling: 0 },
  { relativePath: "components/free-tools-calculator.module.css", importantCeiling: 0 },
  { relativePath: "app/despre/page.module.css", importantCeiling: 0 },
  { relativePath: "app/preturi/page.module.css", importantCeiling: 0 },
  { relativePath: "components/public-legal-page.module.css", importantCeiling: 0 },
  { relativePath: "components/editorial-page.module.css", importantCeiling: 10 },
  { relativePath: "components/dictionary-page.module.css", importantCeiling: 2 },
  { relativePath: "components/gamification-progress-page.module.css", importantCeiling: 0 },
  { relativePath: "components/gamification-result-panel.module.css", importantCeiling: 0 },
  { relativePath: "components/overall-stats-dashboard.module.css", importantCeiling: 0 },
  { relativePath: "app/cont/page.module.css", importantCeiling: 0 },
  { relativePath: "app/review-reward/page.module.css", importantCeiling: 0 },
  { relativePath: "components/account-billing-tabs-client.module.css", importantCeiling: 0 },
  { relativePath: "components/account-danger-zone.module.css", importantCeiling: 0 },
  { relativePath: "components/billing-plan-card.module.css", importantCeiling: 0 },
  { relativePath: "components/billing-success-redirect.module.css", importantCeiling: 0 },
  { relativePath: "components/referral-share-card.module.css", importantCeiling: 0 },
  { relativePath: "components/testimonial-reward-form.module.css", importantCeiling: 0 },
  { relativePath: "components/test-quiz.module.css", importantCeiling: 0 },
  { relativePath: "components/test-page-client.module.css", importantCeiling: 0 },
  { relativePath: "components/interactive-quiz.module.css", importantCeiling: 0 },
  { relativePath: "components/test-result-panel.module.css", importantCeiling: 0 },
  { relativePath: "components/question-correction-button.module.css", importantCeiling: 0 },
  { relativePath: "components/test-insight.module.css", importantCeiling: 0 },
  { relativePath: "components/exam-page-client.module.css", importantCeiling: 0 },
  { relativePath: "app/auth/login/page.module.css", importantCeiling: 0 },
  { relativePath: "app/auth/auth-route.module.css", importantCeiling: 0 },
  { relativePath: "components/email-auth-panel.module.css", importantCeiling: 0 },
  { relativePath: "components/password-reset-form.module.css", importantCeiling: 0 },
  { relativePath: "components/google-sign-in-button.module.css", importantCeiling: 0 },
  { relativePath: "app/onboarding/page.module.css", importantCeiling: 0 },
  { relativePath: "app/onboarding/confirmation.module.css", importantCeiling: 0 },
  { relativePath: "components/onboarding-selection-step.module.css", importantCeiling: 0 },
  { relativePath: "components/onboarding-action-form.module.css", importantCeiling: 0 },
  { relativePath: "components/onboarding-role-choice-lock.module.css", importantCeiling: 0 }
  ,{ relativePath: "components/admin-page-shell.module.css", importantCeiling: 0 }
  ,{ relativePath: "components/admin-route-switcher.module.css", importantCeiling: 0 }
  ,{ relativePath: "components/admin-overview.module.css", importantCeiling: 0 }
  ,{ relativePath: "components/admin-tabs-container.module.css", importantCeiling: 0 }
  ,{ relativePath: "components/admin-table-meta.module.css", importantCeiling: 0 }
  ,{ relativePath: "components/admin-center-client.module.css", importantCeiling: 0 }
  ,{ relativePath: "components/admin-openai-logs-panel.module.css", importantCeiling: 0 }
  ,{ relativePath: "components/admin-upload-errors-panel.module.css", importantCeiling: 0 }
  ,{ relativePath: "components/admin-content-library.module.css", importantCeiling: 0 }
  ,{ relativePath: "components/admin-dictionary-index.module.css", importantCeiling: 0 }
  ,{ relativePath: "components/admin-dictionary-list.module.css", importantCeiling: 0 }
  ,{ relativePath: "components/admin-dictionary-panel.module.css", importantCeiling: 0 }
  ,{ relativePath: "components/admin-dictionary-workflow.module.css", importantCeiling: 0 }
  ,{ relativePath: "components/admin-editorial-article-page.module.css", importantCeiling: 0 }
  ,{ relativePath: "components/admin-editorial-article-workflow.module.css", importantCeiling: 0 }
  ,{ relativePath: "components/admin-editorial-articles-page.module.css", importantCeiling: 0 }
  ,{ relativePath: "components/admin-editorial-library-list.module.css", importantCeiling: 0 }
  ,{ relativePath: "components/admin-editorial-automation-settings.module.css", importantCeiling: 0 }
  ,{ relativePath: "components/admin-generation-prompt-preview.module.css", importantCeiling: 0 }
  ,{ relativePath: "components/admin-linkedin-distribution-center.module.css", importantCeiling: 0 }
  ,{ relativePath: "components/admin-linkedin-distribution.module.css", importantCeiling: 0 }
  ,{ relativePath: "components/linkedin-distribution-settings.module.css", importantCeiling: 0 }
  ,{ relativePath: "components/linkedin-generation-options.module.css", importantCeiling: 0 }
  ,{ relativePath: "app/admin/articole/[articleId]/preview/page.module.css", importantCeiling: 0 }
  ,{ relativePath: "app/admin/dictionar/[termId]/preview/page.module.css", importantCeiling: 0 }
];
const layoutPath = path.join(root, "app", "layout.js");
const rulesPath = path.join(root, "docs", "design", "LAYOUT_SPACING_RULES.md");
const guard = "/* DESIGN-SPACING-GUARD: new layout spacing below this marker must use spacing tokens. */";
const cssSources = globalCssEntries.map((entry) => ({
  ...entry,
  css: fs.readFileSync(path.join(root, entry.relativePath), "utf8")
}));
const primitiveCssSources = primitiveCssEntries.map((relativePath) => ({
  relativePath,
  css: fs.readFileSync(path.join(root, relativePath), "utf8")
}));
const colocatedCssSources = colocatedCssEntries.map((entry) => ({
  ...entry,
  css: fs.readFileSync(path.join(root, entry.relativePath), "utf8")
}));
const tokensCss = cssSources[0].css;
const shellCss = cssSources.find(({ relativePath }) => relativePath === "app/styles/shell/app-shell.css").css;
const legacyCss = cssSources.at(-1).css;
const adminShellCss = fs.readFileSync(path.join(root, "components/admin-page-shell.module.css"), "utf8");
const layout = fs.readFileSync(layoutPath, "utf8").replaceAll("\r\n", "\n");
const rules = fs.readFileSync(rulesPath, "utf8");
const failures = [];

const expectedTokens = {
  "--space-0": "0px",
  "--space-1": "4px",
  "--space-2": "8px",
  "--space-3": "12px",
  "--space-4": "16px",
  "--space-5": "24px",
  "--space-6": "32px",
  "--space-7": "48px",
  "--space-8": "64px"
};

for (const [token, value] of Object.entries(expectedTokens)) {
  if (!new RegExp(`${token}:\\s*${value.replace(".", "\\.")}`).test(tokensCss)) {
    failures.push(`Token lipsă sau modificat: ${token} (${value}).`);
  }
}

for (const requiredRule of ["--page-gutter", "--layout-section-gap", "--layout-card-padding", "DESIGN-SPACING-GUARD"]) {
  if (!rules.includes(requiredRule)) failures.push(`Documentația nu conține regula obligatorie: ${requiredRule}.`);
}

const expectedImportBlock = globalCssEntries
  .map((entry) => `import "${entry.importPath}";`)
  .join("\n");
if (!layout.startsWith(`${expectedImportBlock}\n`)) {
  failures.push("Importurile CSS globale din app/layout.js lipsesc, nu sunt consecutive sau nu respectă ordinea foundations → legacy.");
}

const layoutContracts = [
  { selector: ".app-shell", css: shellCss },
  { selector: ".admin-route-shell", css: adminShellCss },
  { selector: ".admin-route-topbar", css: adminShellCss },
  { selector: ".admin-route-header", css: adminShellCss }
];

for (const { selector, css } of layoutContracts) {
  const start = css.indexOf(selector);
  const end = css.indexOf("}", start);
  const declaration = start >= 0 && end >= start ? css.slice(start, end + 1) : "";
  if (!declaration) {
    failures.push(`Lipsește contractul de layout pentru ${selector}.`);
    continue;
  }
  if (/\b(?:margin|padding|gap)(?:-[a-z]+)?\s*:\s*[^;}]*\d+px/.test(declaration)) {
    failures.push(`${selector} conține spațiere brută; folosește tokenurile de spacing.`);
  }
}

const linkedInCardCss = fs.readFileSync(path.join(root, "components/admin-linkedin-distribution-center.module.css"), "utf8");
const linkedInCardSelector = ".admin-route-content) > .admin-linkedin-center";
const linkedInCardStart = linkedInCardCss.indexOf(linkedInCardSelector);
const linkedInCardEnd = linkedInCardCss.indexOf("}", linkedInCardStart);
const linkedInCardDeclaration = linkedInCardStart >= 0 && linkedInCardEnd >= linkedInCardStart
  ? linkedInCardCss.slice(linkedInCardStart, linkedInCardEnd + 1)
  : "";
if (!/padding:\s*var\(--layout-card-padding\)/.test(linkedInCardDeclaration)) {
  failures.push("Cardul principal LinkedIn trebuie să declare paddingul standard de layout.");
}

for (const { relativePath, css } of cssSources) {
  const guardCount = css.split(guard).length - 1;
  const guardIndex = css.lastIndexOf(guard);
  if (guardCount !== 1 || guardIndex < 0) {
    failures.push(`${relativePath} trebuie să conțină exact un marker DESIGN-SPACING-GUARD.`);
    continue;
  }

  const governedCss = css.slice(guardIndex + guard.length).replaceAll(/\/\*[\s\S]*?\*\//g, "");
  const rawSpacing = /\b(?:margin|padding|gap|row-gap|column-gap)(?:-[a-z]+)?\s*:\s*[^;}{]*\b-?\d+(?:\.\d+)?px/g;
  const violations = governedCss.match(rawSpacing) || [];
  if (violations.length) {
    failures.push(`${relativePath} folosește spațiere brută după marker: ${violations.join(", ")}.`);
  }

  if (relativePath === "app/globals.css") {
    const forbiddenPatternName = /(?:^|-)(?:card|panel|surface|empty|loading|error|success|callout|notice|placeholder|toolbar|filter|search|sort|results|pagination|pager|table|data-grid|list-controls|bulk-actions)(?:$|-)/;
    const newPatternNames = new Set(
      Array.from(governedCss.matchAll(/\.([A-Za-z_][\w-]*)/g), (match) => match[1])
        .filter((className) => forbiddenPatternName.test(className))
    );
    if (newPatternNames.size) {
      failures.push(
        `app/globals.css adaugă patternuri component-specific după marker: ${Array.from(newPatternNames).join(", ")}. Folosește componenta canonică sau un CSS Module colocat.`
      );
    }
  }
}

const moduleRawSpacing = /(?<![-\w])(?:margin|padding|gap|row-gap|column-gap)(?:-[a-z]+)?\s*:\s*[^;}{]*\b-?\d+(?:\.\d+)?px/g;
const broadElementSelector = /^(?:button|input|select|textarea|label)(?=[\s.#:[>+~]|$)/;

for (const { relativePath, css } of primitiveCssSources) {
  const uncommentedCss = css.replaceAll(/\/\*[\s\S]*?\*\//g, "");
  const rawSpacing = uncommentedCss.match(moduleRawSpacing) || [];
  if (rawSpacing.length) {
    failures.push(`${relativePath} folosește spațiere brută: ${rawSpacing.join(", ")}.`);
  }
  if (uncommentedCss.includes("!important")) {
    failures.push(`${relativePath} nu poate folosi !important.`);
  }

  for (const match of uncommentedCss.matchAll(/([^{}]+)\{/g)) {
    const selectorGroup = match[1].trim();
    if (selectorGroup.startsWith("@")) continue;
    for (const selector of selectorGroup.split(",")) {
      if (broadElementSelector.test(selector.trim())) {
        failures.push(`${relativePath} conține selectorul HTML larg: ${selector.trim()}.`);
      }
    }
  }
}

for (const { relativePath, css, importantCeiling } of colocatedCssSources) {
  const uncommentedCss = css.replaceAll(/\/\*[\s\S]*?\*\//g, "");
  const importantCount = uncommentedCss.match(/!important\b/g)?.length || 0;
  if (importantCount > importantCeiling) {
    failures.push(`${relativePath} depășește ceiling-ul !important (${importantCeiling} → ${importantCount}).`);
  }

  const physicalLineCount = css.split(/\r?\n/).length;
  if (physicalLineCount > 800) {
    failures.push(`${relativePath} depășește pragul arhitectural de 800 de linii (${physicalLineCount}).`);
  }
  if (relativePath === "components/referral-share-card.module.css") {
    const nonBlankLineCount = css.split(/\r?\n/).filter((line) => line.trim()).length;
    if (nonBlankLineCount > 600) {
      failures.push(`${relativePath} depășește plafonul de 600 de linii CSS efective (${nonBlankLineCount}).`);
    }
  }

  for (const match of uncommentedCss.matchAll(/([^{}]+)\{/g)) {
    const selectorGroup = match[1].trim();
    if (selectorGroup.startsWith("@")) continue;
    for (const selector of selectorGroup.split(",")) {
      if (broadElementSelector.test(selector.trim())) {
        failures.push(`${relativePath} conține selectorul HTML larg: ${selector.trim()}.`);
      }
    }
  }
}

if (/\.free-tools?-[A-Za-z_][\w-]*/.test(legacyCss)) {
  failures.push("Selectorii globali free-tool-* și free-tools-* au fost retrași; folosește CSS Modules colocate.");
}

const sharedAdminSelectorAllowlist = new Set([
  "admin-tab-action-count",
  "admin-table-code-cell",
  "admin-table-count-cell",
  "admin-table-date-cell",
  "admin-table-link",
  "admin-table-name-cell",
  "admin-table-name-cell--xl",
  "admin-table-name-cell--xxl",
  "admin-table-pill",
  "admin-table-text-cell",
  "admin-table-wide-cell",
  "admin-table-wide-cell--xl"
]);
const forbiddenAdminSelectors = Array.from(
  legacyCss.matchAll(/\.([A-Za-z_][\w-]*admin[A-Za-z_\w-]*|admin-[A-Za-z_][\w-]*)/g),
  (match) => match[1]
).filter((selector) => selector.startsWith("admin-") && !sharedAdminSelectorAllowlist.has(selector));
if (forbiddenAdminSelectors.length) {
  failures.push(`Selectorii Admin retrași au reapărut în globals.css: ${[...new Set(forbiddenAdminSelectors)].join(", ")}.`);
}

if (/\.about-[A-Za-z_][\w-]*/.test(legacyCss)) {
  failures.push("Selectorii globali about-* au fost retrași; folosește CSS Module-ul colocat al rutei /despre.");
}

const sharedNota5PlusSelectors = new Set([
  ".nota5plus-page",
  ".nota5plus-container",
  ".nota5plus-nav",
  ".nota5plus-brand",
  ".nota5plus-brand-mark",
  ".nota5plus-nav-link",
  ".nota5plus-btn",
  ".nota5plus-btn-primary",
  ".nota5plus-btn-secondary",
  ".nota5plus-google-btn",
  ".nota5plus-inline-error",
  ".nota5plus-legal-footer"
]);
const forbiddenAuthSelectors = [
  ...legacyCss.matchAll(/\.(?:nota5plus|email-auth|auth-password|auth|google-signin)-[A-Za-z_][\w-]*/g)
]
  .map(([selector]) => selector)
  .filter((selector) => !sharedNota5PlusSelectors.has(selector));
if (forbiddenAuthSelectors.length) {
  failures.push(
    `Selectorii Auth au fost retrași din globals.css: ${[...new Set(forbiddenAuthSelectors)].join(", ")}.`
  );
}

const forbiddenOnboardingSelectors = [...legacyCss.matchAll(/\.onboarding-[A-Za-z_][\w-]*/g)]
  .map(([selector]) => selector)
  .filter((selector) => selector !== ".onboarding-form-field");
if (forbiddenOnboardingSelectors.length) {
  failures.push(
    `Selectorii Onboarding au fost retrasi din globals.css, cu exceptia puntii shared .onboarding-form-field: ${[...new Set(forbiddenOnboardingSelectors)].join(", ")}.`
  );
}

const forbiddenSharedTestSelectors = [
  ...legacyCss.matchAll(/\.(?:question-correction|question-source|test-recommended|test-customize|test-mistakes|test-setup-actions)(?:-[A-Za-z_][\w-]*)?/g)
].map(([selector]) => selector);
if (forbiddenSharedTestSelectors.length) {
  failures.push(`Selectorii comuni de test au fost retrasi din globals.css: ${[...new Set(forbiddenSharedTestSelectors)].join(", ")}.`);
}

const forbiddenLicentaExamSelectors = [
  ...legacyCss.matchAll(/\.(?:exam-empty-state|licenta-prep|licenta-browse|licenta-result|licenta-community|simple-test|subject-test-insight-link|test-result-followup)(?:-[A-Za-z_][\w-]*)?/g)
].map(([selector]) => selector);
if (forbiddenLicentaExamSelectors.length) {
  failures.push(`Selectorii Teste/Licenta au fost retrasi din globals.css: ${[...new Set(forbiddenLicentaExamSelectors)].join(", ")}.`);
}

if (/\.public-pricing-[A-Za-z_][\w-]*/.test(legacyCss)) {
  failures.push("Selectorii globali public-pricing-* au fost retrași; folosește CSS Module-ul colocat al rutei /preturi.");
}

if (/\.legal-[A-Za-z_][\w-]*/.test(legacyCss)) {
  failures.push("Selectorii globali legal-* au fost retrași; folosește CSS Module-ul colocat pentru documentele publice.");
}

const forbiddenEditorialSelectors = [...legacyCss.matchAll(/\.editorial-[A-Za-z_][\w-]*/g)]
  .map(([selector]) => selector)
  .filter((selector) => selector !== ".editorial-admin-preview");
if (forbiddenEditorialSelectors.length) {
  failures.push(`Selectorii editorial-* publici au fost retrași din globals.css: ${[...new Set(forbiddenEditorialSelectors)].join(", ")}.`);
}

const forbiddenDictionarySelectors = [...legacyCss.matchAll(/\.dictionary-[A-Za-z_][\w-]*/g)]
  .map(([selector]) => selector)
  .filter((selector) => selector !== ".dictionary-admin-preview");
if (forbiddenDictionarySelectors.length) {
  failures.push(`Selectorii dictionary-* publici au fost retrași din globals.css: ${[...new Set(forbiddenDictionarySelectors)].join(", ")}.`);
}

const forbiddenProgressSelectors = [
  ...legacyCss.matchAll(/\.(?:gamification|licenta-stats|overall|dashboard-gamification)-[A-Za-z_][\w-]*/g)
].map(([selector]) => selector);
if (forbiddenProgressSelectors.length) {
  failures.push(
    `Selectorii progres/statistici au fost retrași din globals.css: ${[...new Set(forbiddenProgressSelectors)].join(", ")}.`
  );
}

const forbiddenAccountSelectors = [...legacyCss.matchAll(/\.account-[A-Za-z_][\w-]*/g)]
  .map(([selector]) => selector)
  .filter((selector) => selector !== ".account-billing-tabs");
if (forbiddenAccountSelectors.length) {
  failures.push(
    `Selectorii account-* au fost retrași din globals.css, cu excepția punții admin .account-billing-tabs: ${[...new Set(forbiddenAccountSelectors)].join(", ")}.`
  );
}

const forbiddenAccountFamilySelectors = [
  ...legacyCss.matchAll(/\.(?:billing-success|testimonial|referral-stat)-[A-Za-z_][\w-]*/g)
].map(([selector]) => selector);
if (forbiddenAccountFamilySelectors.length) {
  failures.push(
    `Selectorii Cont/Billing au fost retrași din globals.css: ${[...new Set(forbiddenAccountFamilySelectors)].join(", ")}.`
  );
}

if (legacyCss.includes('button[class=""]')) {
  failures.push('Selectorul legacy button[class=""] trebuie eliminat complet.');
}

const legacySelectorCeilings = {
  "button:not([class])": 2,
  ".btn-back": 21,
  ".btn-link": 38,
  ".secondary": 15,
  ".test-link": 18,
  ".nav-btn": 9,
  ".input-search": 10,
  ".textarea-input": 3,
  ".status-pill": 4,
  ".error-state": 2,
  ".success-state": 1,
  ".surface": 12,
  ".ui-panel-card": 2,
  ".draft-card": 4,
  ".empty-state": 3,
  ".admin-toolbar": 15,
  ".admin-filter-row": 3,
  ".review-list-controls": 7,
  ".review-pagination": 2
};

for (const [selector, ceiling] of Object.entries(legacySelectorCeilings)) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const count = legacyCss.match(new RegExp(escapedSelector, "g"))?.length || 0;
  if (count > ceiling) {
    failures.push(`Selectorul legacy ${selector} a crescut de la limita ${ceiling} la ${count} ramuri.`);
  }
}

for (const removedSelector of [
  ".subjects-empty-state",
  ".route-loading-shell",
  ".route-loading-card",
  ".route-loading-kicker",
  ".route-error-shell",
  ".route-error-card",
  ".route-error-icon",
  ".route-error-actions",
  ".route-error-action",
  ".filters-toolbar",
  ".filter-search",
  ".filter-select",
  ".filter-control-icon",
  ".filter-reset-button",
  ".admin-pagination",
  ".table-scroll",
  ".admin-table-scroll",
  ".admin-table",
  ".table-center",
  ".has-admin-review",
  ".ai-activity-table-scroll",
  ".ai-activity-table",
  ".ai-activity-select-cell",
  ".subjects-table-shell",
  ".subjects-table",
  ".subject-title-cell",
  ".subject-context-list",
  ".subject-context-pill",
  ".subject-actions-row",
  ".subject-table-action",
  ".pricing-section",
  ".plan-grid",
  ".pricing-lock-banner",
  ".plan-price",
  ".plan-card-form",
  ".welcome-premium-card",
  ".welcome-premium-form"
]) {
  const escapedSelector = removedSelector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const selectorPattern = new RegExp(`${escapedSelector}(?=[\\s.#:[>+~,\\{])`);
  if (selectorPattern.test(legacyCss)) {
    failures.push(`Selectorul retras ${removedSelector} nu poate fi reintrodus în app/globals.css.`);
  }
}

if (failures.length) {
  console.error("Design spacing check failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Design spacing check passed (${cssSources.length} fișiere CSS globale, ${primitiveCssSources.length} module canonice, ${colocatedCssSources.length} module colocate).`);
