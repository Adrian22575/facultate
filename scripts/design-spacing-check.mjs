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
const layoutPath = path.join(root, "app", "layout.js");
const rulesPath = path.join(root, "docs", "design", "LAYOUT_SPACING_RULES.md");
const guard = "/* DESIGN-SPACING-GUARD: new layout spacing below this marker must use spacing tokens. */";
const cssSources = globalCssEntries.map((entry) => ({
  ...entry,
  css: fs.readFileSync(path.join(root, entry.relativePath), "utf8")
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
}

if (failures.length) {
  console.error("Design spacing check failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Design spacing check passed (${cssSources.length} fișiere CSS globale).`);
