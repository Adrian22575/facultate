import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const cssPath = path.join(root, "app", "globals.css");
const rulesPath = path.join(root, "docs", "design", "LAYOUT_SPACING_RULES.md");
const guard = "/* DESIGN-SPACING-GUARD: new layout spacing below this marker must use spacing tokens. */";
const css = fs.readFileSync(cssPath, "utf8");
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
  if (!new RegExp(`${token}:\\s*${value.replace(".", "\\.")}`).test(css)) {
    failures.push(`Token lipsă sau modificat: ${token} (${value}).`);
  }
}

for (const requiredRule of ["--page-gutter", "--layout-section-gap", "--layout-card-padding", "Nu se introduc valori noi", "DESIGN-SPACING-GUARD"]) {
  if (!rules.includes(requiredRule)) failures.push(`Documentația nu conține regula obligatorie: ${requiredRule}.`);
}

for (const selector of [".app-shell", ".admin-route-shell", ".admin-route-topbar", ".admin-route-header"]) {
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

const guardIndex = css.lastIndexOf(guard);
if (guardIndex < 0) {
  failures.push("Lipsește markerul DESIGN-SPACING-GUARD din app/globals.css.");
} else {
  const governedCss = css.slice(guardIndex + guard.length).replaceAll(/\/\*[\s\S]*?\*\//g, "");
  const rawSpacing = /\b(?:margin|padding|gap|row-gap|column-gap)(?:-[a-z]+)?\s*:\s*[^;}{]*\b-?\d+(?:\.\d+)?px/g;
  const violations = governedCss.match(rawSpacing) || [];
  if (violations.length) {
    failures.push(`CSS nou folosește spațiere brută după marker: ${violations.join(", ")}.`);
  }
}

if (failures.length) {
  console.error("Design spacing check failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Design spacing check passed.");
