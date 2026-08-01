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
  "components/ui/collection-controls.module.css"
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
const tokensCss = cssSources[0].css;
const shellCss = cssSources.find(({ relativePath }) => relativePath === "app/styles/shell/app-shell.css").css;
const legacyCss = cssSources.at(-1).css;
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
  { selector: ".admin-route-shell", css: legacyCss },
  { selector: ".admin-route-topbar", css: legacyCss },
  { selector: ".admin-route-header", css: legacyCss }
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

const linkedInCardSelector = ".admin-route-content > .admin-linkedin-center";
const linkedInCardStart = legacyCss.indexOf(linkedInCardSelector);
const linkedInCardEnd = legacyCss.indexOf("}", linkedInCardStart);
const linkedInCardDeclaration = linkedInCardStart >= 0 && linkedInCardEnd >= linkedInCardStart
  ? legacyCss.slice(linkedInCardStart, linkedInCardEnd + 1)
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
  ".review-pagination": 2,
  ".table-scroll": 1,
  ".admin-table-scroll": 3,
  ".admin-table": 59
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
  ".admin-pagination"
]) {
  if (legacyCss.includes(removedSelector)) {
    failures.push(`Selectorul retras ${removedSelector} nu poate fi reintrodus în app/globals.css.`);
  }
}

if (failures.length) {
  console.error("Design spacing check failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Design spacing check passed (${cssSources.length} fișiere CSS globale, ${primitiveCssSources.length} module canonice).`);
