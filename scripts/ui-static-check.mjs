import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { parse } = require("next/dist/compiled/babel/eslint-parser");

const ROOT = process.cwd();
const SOURCE_ROOTS = ["app", "components"];
const ROUTE_ALIASES = [/^\/materiale(?:\/.*)?$/];
const LEGACY_UI_TOKENS = [
  "btn-back", "btn-link", "secondary", "test-link", "nav-btn",
  "input-search", "textarea-input", "status-pill", "error-state", "success-state",
  "surface", "ui-panel-card", "draft-card", "empty-state",
  "admin-toolbar", "admin-filter-row", "review-list-controls", "review-pagination",
  "table-scroll", "admin-table-scroll", "admin-table"
];
const CANONICAL_EXPORT_PATHS = {
  Button: "components/ui/action.js",
  ActionLink: "components/ui/action.js",
  TextField: "components/ui/form-field.js",
  SelectField: "components/ui/form-field.js",
  TextareaField: "components/ui/form-field.js",
  StatusPill: "components/ui/status.js",
  InlineFeedback: "components/ui/status.js",
  SurfaceCard: "components/ui/surface-card.js",
  EmptyState: "components/ui/state.js",
  LoadingState: "components/ui/state.js",
  FeedbackState: "components/ui/state.js",
  FiltersToolbar: "components/ui/collection-controls.js",
  FilterSearch: "components/ui/collection-controls.js",
  FilterSelect: "components/ui/collection-controls.js",
  FilterSortSelect: "components/ui/collection-controls.js",
  ResultsSummary: "components/ui/collection-controls.js",
  Pagination: "components/ui/collection-controls.js",
  DataTable: "components/ui/data-table.js",
  DataTableCell: "components/ui/data-table.js",
  SectionLabel: "components/ui/section-label.js",
  ProgressBar: "components/ui/progress-bar.js",
  DialogShell: "components/ui/dialog-shell.js"
};
const CANONICAL_PATTERN_DEFINITION_ALLOWLIST = {
  SurfaceCard: new Set(["components/ui/surface-card.js"]),
  EmptyState: new Set([
    "components/ui/state.js",
    "components/admin-center-client.js",
    "components/ai-activity-center-client.js"
  ]),
  LoadingState: new Set(["components/ui/state.js"]),
  FeedbackState: new Set(["components/ui/state.js"]),
  FiltersToolbar: new Set(["components/ui/collection-controls.js"]),
  FilterSearch: new Set(["components/ui/collection-controls.js"]),
  FilterSelect: new Set(["components/ui/collection-controls.js"]),
  FilterSortSelect: new Set(["components/ui/collection-controls.js"]),
  ResultsSummary: new Set(["components/ui/collection-controls.js"]),
  Pagination: new Set(["components/ui/collection-controls.js"]),
  DataTable: new Set(["components/ui/data-table.js"]),
  DataTableCell: new Set(["components/ui/data-table.js"]),
  SectionLabel: new Set(["components/ui/section-label.js"]),
  ProgressBar: new Set(["components/ui/progress-bar.js"]),
  DialogShell: new Set(["components/ui/dialog-shell.js"])
};
const LEGACY_UI_BASELINE = {
  "app/ai/activitate/page.js": { "btn-link": 1, secondary: 1, "error-state": 1, "btn-back": 1 },
  "app/ai/drafts/[testId]/page.js": { "btn-back": 1, "success-state": 1, "input-search": 2, button: 3, "btn-link": 1, secondary: 1, "textarea-input": 2 },
  "app/ai/imports/[importId]/page.js": { "btn-back": 1 },
  "app/ai/invata/page.js": { "error-state": 2 },
  "app/ai/invata/[studySetId]/page.js": { "btn-back": 2, "error-state": 1 },
  "app/ai/jobs/[jobId]/page.js": { "btn-back": 1 },
  "app/ai/licenta/[sessionId]/page.js": { "btn-back": 1 },
  "app/ai/page.js": { "btn-link": 1, secondary: 1 },
  "app/ai/review/[bankId]/page.js": { "btn-back": 1, "success-state": 1, "status-pill": 3 },
  "app/global-error.js": { button: 1 },
  "app/materii/[subjectId]/interactiv/page.js": { "btn-back": 1 },
  "app/materii/[subjectId]/page.js": { "btn-back": 1 },
  "app/materii/[subjectId]/studiu/page.js": { "btn-back": 1 },
  "app/materii/[subjectId]/test/page.js": { "btn-back": 1 },
  "app/setup/page.js": { "btn-back": 2, "btn-link": 2, secondary: 2, "error-state": 2 },
  "app/testele-mele/page.js": { "btn-back": 2, "success-state": 1, "error-state": 2, "btn-link": 4, secondary: 4 },
  "app/testele-mele/[testId]/page.js": { "btn-back": 1 },
  "components/admin-center-client.js": { "btn-link": 11, secondary: 11, "status-pill": 16, "btn-back": 1 },
  "components/admin-dictionary-index.js": { "btn-link": 1, button: 1 },
  "components/admin-dictionary-panel.js": { "btn-back": 5, "btn-link": 3 },
  "components/admin-editorial-article-page.js": { "btn-link": 5, "btn-back": 4 },
  "components/admin-editorial-articles-page.js": { "btn-link": 1, button: 1 },
  "components/admin-editorial-automation-settings.js": { "btn-link": 1 },
  "components/admin-linkedin-distribution-center.js": { "btn-back": 2 },
  "components/admin-linkedin-distribution.js": { "btn-link": 3, "btn-back": 1 },
  "components/admin-openai-logs-panel.js": { "btn-link": 6, secondary: 6, "error-state": 2, "status-pill": 3 },
  "components/admin-upload-errors-panel.js": { "btn-link": 3, secondary: 3, "status-pill": 1 },
  "components/ai-activity-center-client.js": { "btn-link": 5, secondary: 14, "status-pill": 2, "btn-back": 1, "input-search": 1, "error-state": 1, "success-state": 2 },
  "components/ai-job-status-client.js": { secondary: 6, "btn-link": 4, "error-state": 3, "status-pill": 2, "btn-back": 3 },
  "components/ai-question-bank-review-client.js": { "status-pill": 1, "btn-link": 11, secondary: 15, "textarea-input": 4, "input-search": 2, button: 2, "success-state": 1, "error-state": 1 },
  "components/app-header.js": { "status-pill": 1 },
  "components/dictionary-index-client.js": { button: 1 },
  "components/editorial-index-client.js": { button: 1 },
  "components/exam-page-client.js": { "btn-link": 6, secondary: 14, button: 4 },
  "components/feedback-launcher.js": { "textarea-input": 1, "btn-link": 2, secondary: 2, "input-search": 1, "error-state": 1, "success-state": 1, button: 1 },
  "components/free-tools-calculator.js": { button: 2 },
  "components/import-job-status-client.js": { "textarea-input": 2, "btn-link": 24, secondary: 27, "input-search": 3, button: 3, "status-pill": 3, "error-state": 6, "success-state": 1, "btn-back": 2 },
  "components/interactive-quiz.js": { "error-state": 1, "nav-btn": 2, secondary: 1 },
  "components/learning-study-set-client.js": { secondary: 18, "btn-link": 3, button: 9 },
  "components/learning-upload-form.js": { "error-state": 1, "btn-link": 1, secondary: 1, "input-search": 3, button: 1 },
  "components/licenta-import-workspace-client.js": { "status-pill": 2, "error-state": 5, "btn-back": 3, button: 3, "success-state": 1, secondary: 9, "btn-link": 5, "textarea-input": 1 },
  "components/licenta-session-workspace-client.js": { "success-state": 1, "status-pill": 3, "error-state": 1, "btn-link": 17, secondary: 20, "btn-back": 2, "textarea-input": 1, "input-search": 1, button: 2 },
  "components/linkedin-distribution-settings.js": { "btn-back": 1 },
  "components/mode-grid.js": { button: 1, "btn-link": 1 },
  "components/private-test-player.js": { "btn-link": 1, secondary: 1, button: 2 },
  "components/question-correction-button.js": { secondary: 3, button: 1 },
  "components/review-publish-bar.js": { button: 1, "btn-back": 1 },
  "components/subjects-list-client.js": { "btn-link": 1, secondary: 1 },
  "components/test-page-client.js": { "btn-link": 3, secondary: 7, button: 2, "error-state": 1 },
  "components/testimonial-reward-form.js": { "textarea-input": 1 },
  "components/workspace-generate-form.js": { "error-state": 4, "success-state": 1, "btn-link": 4, secondary: 8, "textarea-input": 1, "input-search": 1, button: 1 },
  "components/workspace-subject-picker.js": { "input-search": 2, "btn-link": 2, secondary: 2, "success-state": 1, "error-state": 1, button: 1 },
  "components/workspace-upload-shell.js": { "btn-back": 1 }
};
const LEGACY_SURFACE_BASELINE = {
  "app/ai/activitate/page.js": { surface: 1, "ui-panel-card": 1 },
  "app/ai/drafts/[testId]/page.js": { surface: 5, "draft-card": 1 },
  "app/ai/review/[bankId]/page.js": { surface: 2 },
  "app/demo/page.js": { surface: 2 },
  "app/setup/page.js": { surface: 6, "draft-card": 1, "empty-state": 2 },
  "app/testele-mele/page.js": { surface: 4, "draft-card": 3, "empty-state": 3 },
  "components/admin-dictionary-panel.js": { surface: 1 },
  "components/ai-activity-center-client.js": { surface: 1, "ui-panel-card": 1 },
  "components/ai-job-status-client.js": { surface: 4 },
  "components/ai-question-bank-review-client.js": { surface: 4, "draft-card": 4 },
  "components/exam-page-client.js": { surface: 5 },
  "components/import-job-status-client.js": { surface: 4, "draft-card": 8 },
  "components/interactive-quiz.js": { surface: 1 },
  "components/learning-upload-form.js": { surface: 1 },
  "components/licenta-import-workspace-client.js": { "ui-panel-card": 6, "draft-card": 1 },
  "components/licenta-session-workspace-client.js": { surface: 5, "draft-card": 1 },
  "components/private-test-player.js": { surface: 1 },
  "components/test-page-client.js": { surface: 2 },
  "components/workspace-generate-form.js": { "ui-panel-card": 7 },
  "components/workspace-subject-picker.js": { "ui-panel-card": 2, "empty-state": 1 }
};
const LEGACY_COLLECTION_BASELINE = {
  "components/admin-center-client.js": { "admin-toolbar": 7, "admin-filter-row": 5 },
  "components/admin-openai-logs-panel.js": { "admin-toolbar": 1, "admin-filter-row": 1 },
  "components/admin-upload-errors-panel.js": { "admin-toolbar": 1 },
  "components/ai-question-bank-review-client.js": { "review-list-controls": 1, "review-pagination": 1 }
};
const NATIVE_TABLE_BASELINE = {
  "components/ui/data-table.js": 1
};
const MOJIBAKE_TOKENS = ["Ã", "Äƒ", "Ä‚", "È™", "Èš", "È›", "Â·", "â€™", "â€œ", "â€", "â€“", "â€”", "�"];

function walkFiles(directory, predicate) {
  const result = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...walkFiles(absolutePath, predicate));
    else if (predicate(absolutePath)) result.push(absolutePath);
  }
  return result;
}

function jsxName(node) {
  if (!node) return "";
  if (node.type === "JSXIdentifier") return node.name;
  if (node.type === "JSXMemberExpression") return `${jsxName(node.object)}.${jsxName(node.property)}`;
  return "";
}

function getAttribute(openingElement, name) {
  return openingElement.attributes.find(
    (attribute) =>
      attribute.type === "JSXAttribute" &&
      attribute.name?.type === "JSXIdentifier" &&
      attribute.name.name === name
  );
}

function staticAttributeValue(attribute) {
  if (!attribute) return null;
  if (!attribute.value) return "";
  if (attribute.value.type === "Literal") return String(attribute.value.value ?? "");
  return null;
}

function staticExpressionValue(node) {
  if (!node) return null;
  if (node.type === "Literal" && typeof node.value === "string") return node.value;
  if (node.type === "TemplateLiteral" && node.expressions.length === 0) {
    return node.quasis.map((quasi) => quasi.value?.cooked || "").join("");
  }
  return null;
}

function collectStaticClassParts(node, parts = []) {
  if (!node) return parts;
  if (node.type === "Literal" && typeof node.value === "string") {
    parts.push(node.value);
    return parts;
  }
  if (node.type === "TemplateLiteral") {
    for (const quasi of node.quasis) parts.push(quasi.value?.cooked || "");
    for (const expression of node.expressions) collectStaticClassParts(expression, parts);
    return parts;
  }
  if (node.type === "ConditionalExpression") {
    collectStaticClassParts(node.consequent, parts);
    collectStaticClassParts(node.alternate, parts);
    return parts;
  }
  if (node.type === "LogicalExpression" || node.type === "BinaryExpression") {
    collectStaticClassParts(node.left, parts);
    collectStaticClassParts(node.right, parts);
  }
  return parts;
}

function staticClassTokens(attribute) {
  if (!attribute?.value) return new Set();
  const parts = attribute.value.type === "Literal"
    ? [String(attribute.value.value || "")]
    : attribute.value.type === "JSXExpressionContainer"
      ? collectStaticClassParts(attribute.value.expression)
      : [];
  return new Set(parts.flatMap((part) => part.split(/\s+/)).filter(Boolean));
}

function attributeTemplatePattern(attribute) {
  const expression = attribute?.value?.type === "JSXExpressionContainer" ? attribute.value.expression : null;
  if (expression?.type !== "TemplateLiteral") return null;
  const source = expression.quasis
    .map((quasi, index) => {
      const text = String(quasi.value?.cooked || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return index < expression.expressions.length ? `${text}.+` : text;
    })
    .join("");
  return new RegExp(`^${source}$`);
}

function hasPotentialText(children) {
  for (const child of children || []) {
    if (child.type === "JSXText" && child.value.trim()) return true;
    if (child.type === "JSXExpressionContainer" && child.expression?.type !== "JSXEmptyExpression") return true;
    if (child.type === "JSXElement" && hasPotentialText(child.children)) return true;
    if (child.type === "JSXFragment" && hasPotentialText(child.children)) return true;
  }
  return false;
}

function hasAccessibleAttribute(openingElement) {
  return Boolean(getAttribute(openingElement, "aria-label") || getAttribute(openingElement, "aria-labelledby"));
}

function routePatternFromPage(filePath) {
  const relativeDirectory = path.relative(path.join(ROOT, "app"), path.dirname(filePath));
  const segments = relativeDirectory
    .split(path.sep)
    .filter(Boolean)
    .filter((segment) => !segment.startsWith("(") && !segment.startsWith("@"));

  const pattern = segments
    .map((segment) => {
      if (/^\[\[\.\.\..+\]\]$/.test(segment)) return "(?:/.*)?";
      if (/^\[\.\.\..+\]$/.test(segment)) return "/.+";
      if (/^\[.+\]$/.test(segment)) return "/[^/]+";
      return `/${segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`;
    })
    .join("");

  return new RegExp(`^${pattern || "/"}/?$`);
}

const sourceFiles = SOURCE_ROOTS.flatMap((directory) =>
  walkFiles(path.join(ROOT, directory), (filePath) => filePath.endsWith(".js"))
);
const routePatterns = walkFiles(
  path.join(ROOT, "app"),
  (filePath) => ["page.js", "route.js"].includes(path.basename(filePath))
).map(routePatternFromPage);
const failures = [];

function report(filePath, node, message) {
  failures.push({
    file: path.relative(ROOT, filePath).replaceAll("\\", "/"),
    line: node.loc?.start?.line || 1,
    message
  });
}

function internalRouteExists(href) {
  if (!href.startsWith("/") || href.startsWith("//")) return true;
  const pathname = href.split(/[?#]/, 1)[0] || "/";
  return routePatterns.some((pattern) => pattern.test(pathname)) || ROUTE_ALIASES.some((pattern) => pattern.test(pathname));
}

function isInsideLabel(ancestors) {
  return ancestors.some(
    (ancestor) => {
      if (ancestor.type !== "JSXElement") return false;
      const name = jsxName(ancestor.openingElement?.name);
      if (name === "label") return true;
      return name === "AuthInput" && Boolean(getAttribute(ancestor.openingElement, "label"));
    }
  );
}

function inspectElement(filePath, node, context, ancestors) {
  const opening = node.openingElement;
  const name = jsxName(opening.name);
  const role = staticAttributeValue(getAttribute(opening, "role"));
  const classAttribute = getAttribute(opening, "className");
  const className = staticAttributeValue(classAttribute) || "";
  const classTokens = staticClassTokens(classAttribute);

  for (const token of classTokens) {
    const relativePath = path.relative(ROOT, filePath).replaceAll("\\", "/");
    const scopedAdminOwners = new Set([
      "components/admin-page-shell.js",
      "components/admin-route-switcher.js",
      "components/admin-overview.js",
      "components/admin-tabs-container.js",
      "components/admin-table-meta.js",
      "components/admin-center-client.js",
      "components/admin-openai-logs-panel.js",
      "components/admin-upload-errors-panel.js",
      "components/admin-dictionary-index.js",
      "components/admin-dictionary-panel.js",
      "components/admin-editorial-articles-page.js",
      "components/admin-editorial-article-page.js",
      "components/admin-editorial-automation-settings.js",
      "components/admin-generation-prompt-preview.js",
      "components/admin-linkedin-distribution-center.js",
      "components/admin-linkedin-distribution.js",
      "components/linkedin-distribution-settings.js",
      "app/admin/articole/[articleId]/preview/page.js",
      "app/admin/dictionar/[termId]/preview/page.js"
    ]);
    const sharedAdminTokens = new Set([
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
    if (/^admin-/.test(token) && !sharedAdminTokens.has(token) && !scopedAdminOwners.has(relativePath)) {
      report(filePath, opening, `Clasa Admin colocată ${token} poate fi folosită numai de proprietarii Admin aprobați.`);
    }
    const sharedNota5PlusTokens = new Set([
      "nota5plus-page",
      "nota5plus-container",
      "nota5plus-nav",
      "nota5plus-brand",
      "nota5plus-brand-mark",
      "nota5plus-nav-link",
      "nota5plus-btn",
      "nota5plus-btn-primary",
      "nota5plus-btn-secondary",
      "nota5plus-google-btn",
      "nota5plus-inline-error",
      "nota5plus-legal-footer"
    ]);
    if (/^(?:nota5plus|email-auth|auth-password|auth|google-signin)-/.test(token) && !sharedNota5PlusTokens.has(token)) {
      report(filePath, opening, `Clasa globală Auth retrasă ${token} trebuie înlocuită cu CSS Module-ul colocat.`);
    }
    if (/^onboarding-/.test(token)) {
      const relativePath = path.relative(ROOT, filePath).replaceAll("\\", "/");
      const sharedFieldOwners = new Set([
        "components/ai-activity-center-client.js",
        "components/feedback-launcher.js",
        "components/workspace-subject-picker.js"
      ]);
      const allowedSharedField = token === "onboarding-form-field" && sharedFieldOwners.has(relativePath);
      if (!allowedSharedField) {
        report(filePath, opening, `Clasa globala Onboarding retrasa ${token} trebuie inlocuita cu CSS Module-ul colocat.`);
      }
    }
    if (/^free-tools?-/.test(token)) {
      report(filePath, opening, `Clasa globală retrasă ${token} trebuie înlocuită cu CSS Module-ul colocat.`);
    }
    if (/^about-/.test(token)) {
      report(filePath, opening, `Clasa globală retrasă ${token} trebuie înlocuită cu CSS Module-ul colocat al rutei /despre.`);
    }
    if (/^public-pricing-/.test(token)) {
      report(filePath, opening, `Clasa globală retrasă ${token} trebuie înlocuită cu CSS Module-ul colocat al rutei /preturi.`);
    }
    if (/^legal-/.test(token)) {
      report(filePath, opening, `Clasa globală retrasă ${token} trebuie înlocuită cu CSS Module-ul colocat pentru documentele publice.`);
    }
    if (/^editorial-/.test(token)) {
      const relativePath = path.relative(ROOT, filePath).replaceAll("\\", "/");
      const allowedPreview = token === "editorial-admin-preview" && relativePath === "app/admin/articole/[articleId]/preview/page.js";
      if (!allowedPreview) {
        report(filePath, opening, `Clasa globală retrasă ${token} trebuie înlocuită cu CSS Module-ul editorial colocat.`);
      }
    }
    if (/^dictionary-/.test(token)) {
      const relativePath = path.relative(ROOT, filePath).replaceAll("\\", "/");
      const allowedPreview = token === "dictionary-admin-preview" && relativePath === "app/admin/dictionar/[termId]/preview/page.js";
      if (!allowedPreview) {
        report(filePath, opening, `Clasa globală retrasă ${token} trebuie înlocuită cu CSS Module-ul dicționarului colocat.`);
      }
    }
    if (/^(?:gamification|licenta-stats|overall|dashboard-gamification)-/.test(token)) {
      report(filePath, opening, `Clasa globală retrasă ${token} trebuie înlocuită cu CSS Module-ul colocat pentru progres și statistici.`);
    }
    if (/^account-/.test(token)) {
      const relativePath = path.relative(ROOT, filePath).replaceAll("\\", "/");
      const allowedAdminBridge = token === "account-billing-tabs" && relativePath === "components/admin-tabs-container.js";
      if (!allowedAdminBridge) {
        report(filePath, opening, `Clasa globală retrasă ${token} trebuie înlocuită cu CSS Module-ul colocat pentru Cont.`);
      }
    }
    if (/^(?:billing-success|testimonial|referral-stat)-/.test(token)) {
      report(filePath, opening, `Clasa globală retrasă ${token} trebuie înlocuită cu CSS Module-ul colocat pentru Cont și Billing.`);
    }
    if (/^(?:question-correction|question-source|test-recommended|test-mistakes)-/.test(token) || ["test-customize", "test-setup-actions"].includes(token)) {
      report(filePath, opening, `Clasa globala retrasa ${token} trebuie inlocuita cu CSS Module-ul colocat pentru teste.`);
    }
    if (/^(?:exam-empty-state|licenta-prep|licenta-browse|licenta-result|licenta-community|simple-test|subject-test-insight-link|test-result-followup)(?:-|$)/.test(token)) {
      report(filePath, opening, `Clasa globala retrasa ${token} trebuie inlocuita cu CSS Module-ul colocat pentru Teste si Licenta.`);
    }
    if ([
      "pricing-section",
      "plan-grid",
      "pricing-lock-banner",
      "plan-price",
      "plan-card-form",
      "welcome-premium-card",
      "welcome-premium-form"
    ].includes(token)) {
      report(filePath, opening, `Clasa globală retrasă ${token} trebuie înlocuită cu CSS Module-ul proprietarului.`);
    }
  }

  for (const token of LEGACY_UI_TOKENS) {
    if (classTokens.has(token)) {
      context.legacyCounts[token] = (context.legacyCounts[token] || 0) + 1;
    }
  }

  if (name === "button" && !classAttribute) {
    context.legacyCounts.button = (context.legacyCounts.button || 0) + 1;
  }
  if (name === "button" && classAttribute && staticAttributeValue(classAttribute) === "") {
    report(filePath, opening, "Butonul nu poate declara className gol.");
  }
  if (name === "table") {
    context.nativeTableCount += 1;
    if (!filePath.endsWith(path.join("components", "ui", "data-table.js"))) {
      report(filePath, opening, "Tabelele native sunt rezervate componentei canonice DataTable.");
    }
  }
  if (name === "th" && staticAttributeValue(getAttribute(opening, "scope")) !== "col") {
    report(filePath, opening, "Headerul de tabel trebuie sa declare scope=\"col\".");
  }
  if (name === "DataTable" && !getAttribute(opening, "caption")) {
    report(filePath, opening, "DataTable necesita un caption accesibil.");
  }
  if (
    name === "td" &&
    ancestors.some((ancestor) => {
      if (ancestor.type !== "JSXElement") return false;
      const ancestorOpening = ancestor.openingElement;
      return jsxName(ancestorOpening?.name) === "DataTable" &&
        staticAttributeValue(getAttribute(ancestorOpening, "responsive")) === "cards";
    }) &&
    !getAttribute(opening, "data-label")
  ) {
    report(filePath, opening, "Celulele DataTable cu responsive=\"cards\" necesita data-label.");
  }

  for (const relation of ["aria-labelledby", "aria-controls"]) {
    const targets = staticAttributeValue(getAttribute(opening, relation));
    if (targets) {
      for (const target of targets.split(/\s+/).filter(Boolean)) {
        if (!context.ids.has(target) && !context.idPatterns.some((pattern) => pattern.test(target))) {
          report(filePath, opening, `${relation} indica un id inexistent: ${target}`);
        }
      }
    }
  }

  if (role === "dialog" && !hasAccessibleAttribute(opening)) {
    report(filePath, opening, "Dialogul nu are aria-label sau aria-labelledby.");
  }
  if (role === "dialog" && !getAttribute(opening, "ref")) {
    report(filePath, opening, "Dialogul nu este conectat la managementul de focus.");
  }

  if (role === "tab") {
    if (!getAttribute(opening, "aria-selected")) {
      report(filePath, opening, "Tabul nu expune aria-selected.");
    }
    if (!getAttribute(opening, "aria-controls")) {
      report(filePath, opening, "Tabul nu indica panoul controlat prin aria-controls.");
    }
    if (!getAttribute(opening, "tabIndex")) {
      report(filePath, opening, "Tabul nu gestioneaza tabIndex pentru navigarea cu tastatura.");
    }
  }

  if (role === "tablist" && !getAttribute(opening, "onKeyDown")) {
    report(filePath, opening, "Lista de taburi nu gestioneaza navigarea cu tastatura.");
  }

  if (role === "tabpanel" && !hasAccessibleAttribute(opening)) {
    report(filePath, opening, "Panoul de tab nu are aria-label sau aria-labelledby.");
  }

  if (
    /(error-state|success-state|inline-error|inline-success|save-message)/.test(className) &&
    !getAttribute(opening, "role") &&
    !getAttribute(opening, "aria-live")
  ) {
    report(filePath, opening, "Mesajul de feedback nu are role sau aria-live.");
  }

  const isCanonicalButtonHost = path.relative(ROOT, filePath).replaceAll("\\", "/") === "components/ui/action.js";
  if (name === "button" && !isCanonicalButtonHost && !hasAccessibleAttribute(opening) && !hasPotentialText(node.children)) {
    report(filePath, opening, "Butonul fara text vizibil nu are nume accesibil.");
  }
  if (name === "button" && !getAttribute(opening, "type")) {
    report(filePath, opening, "Butonul nu declara explicit type.");
  }

  if (name === "img" || name === "Image") {
    if (!getAttribute(opening, "alt")) {
      report(filePath, opening, `${name} nu are atributul alt.`);
    }
  }

  if (["input", "select", "textarea"].includes(name)) {
    const type = (staticAttributeValue(getAttribute(opening, "type")) || "text").toLowerCase();
    const exemptInputTypes = new Set(["hidden", "submit", "button", "reset", "image"]);
    const id = staticAttributeValue(getAttribute(opening, "id"));
    const hasLabel =
      hasAccessibleAttribute(opening) ||
      isInsideLabel(ancestors) ||
      (id !== null && id !== "" && context.labelTargets.has(id));

    if (!(name === "input" && exemptInputTypes.has(type)) && !hasLabel) {
      report(filePath, opening, `${name} nu are o eticheta accesibila asociata.`);
    }
    if (name === "input" && ["email", "password", "tel"].includes(type) && !getAttribute(opening, "autoComplete")) {
      report(filePath, opening, `Campul ${type} nu declara autoComplete.`);
    }
  }

  if (name === "a" || name === "Link") {
    const href = staticAttributeValue(getAttribute(opening, "href"));
    if (href !== null && href && !internalRouteExists(href)) {
      report(filePath, opening, `Link intern catre ruta inexistenta: ${href}`);
    }
    if (staticAttributeValue(getAttribute(opening, "target")) === "_blank") {
      const rel = staticAttributeValue(getAttribute(opening, "rel")) || "";
      if (!/\b(noopener|noreferrer)\b/.test(rel)) {
        report(filePath, opening, "Linkul deschis in tab nou nu foloseste noopener sau noreferrer.");
      }
    }
  }


  if (name === "form") {
    const action = staticAttributeValue(getAttribute(opening, "action"));
    if (action !== null && action && !internalRouteExists(action)) {
      report(filePath, opening, `Formular catre ruta inexistenta: ${action}`);
    }
  }
}

function getStaticNavigationTarget(node) {
  if (node.type !== "CallExpression") return null;
  const value = staticExpressionValue(node.arguments?.[0]);
  if (!value) return null;

  if (
    node.callee?.type === "Identifier" &&
    ["redirect", "permanentRedirect"].includes(node.callee.name)
  ) {
    return value;
  }

  if (node.callee?.type !== "MemberExpression" || node.callee.computed) return null;
  const method = node.callee.property?.name;
  const owner = node.callee.object;

  if (
    owner?.type === "Identifier" &&
    owner.name === "router" &&
    ["push", "replace"].includes(method)
  ) {
    return value;
  }

  if (
    owner?.type === "MemberExpression" &&
    !owner.computed &&
    owner.object?.type === "Identifier" &&
    owner.object.name === "window" &&
    owner.property?.name === "location" &&
    ["assign", "replace"].includes(method)
  ) {
    return value;
  }

  return null;
}

function traverse(filePath, node, context, ancestors = []) {
  if (!node || typeof node !== "object") return;
  if (node.type === "JSXElement") inspectElement(filePath, node, context, ancestors);
  const navigationTarget = getStaticNavigationTarget(node);
  if (navigationTarget && !internalRouteExists(navigationTarget)) {
    report(filePath, node, `Navigare catre ruta inexistenta: ${navigationTarget}`);
  }

  const nextAncestors = node.type === "JSXElement" ? [...ancestors, node] : ancestors;

  for (const [key, value] of Object.entries(node)) {
    if (["loc", "range", "tokens", "comments"].includes(key)) continue;
    if (Array.isArray(value)) {
      for (const item of value) traverse(filePath, item, context, nextAncestors);
    } else if (value && typeof value === "object") {
      traverse(filePath, value, context, nextAncestors);
    }
  }
}

function collectLabelTargets(node, targets = new Set()) {
  if (!node || typeof node !== "object") return targets;
  if (node.type === "JSXElement" && jsxName(node.openingElement?.name) === "label") {
    const target = staticAttributeValue(getAttribute(node.openingElement, "htmlFor"));
    if (target) targets.add(target);
  }

  for (const [key, value] of Object.entries(node)) {
    if (["loc", "range", "tokens", "comments"].includes(key)) continue;
    if (Array.isArray(value)) {
      for (const item of value) collectLabelTargets(item, targets);
    } else if (value && typeof value === "object") {
      collectLabelTargets(value, targets);
    }
  }
  return targets;
}

function collectStaticIds(node, ids = new Set()) {
  if (!node || typeof node !== "object") return ids;
  if (node.type === "JSXElement") {
    const id = staticAttributeValue(getAttribute(node.openingElement, "id"));
    if (id) ids.add(id);
  }

  for (const [key, value] of Object.entries(node)) {
    if (["loc", "range", "tokens", "comments"].includes(key)) continue;
    if (Array.isArray(value)) {
      for (const item of value) collectStaticIds(item, ids);
    } else if (value && typeof value === "object") {
      collectStaticIds(value, ids);
    }
  }
  return ids;
}

function collectIdPatterns(node, patterns = []) {
  if (!node || typeof node !== "object") return patterns;
  if (node.type === "JSXElement") {
    const pattern = attributeTemplatePattern(getAttribute(node.openingElement, "id"));
    if (pattern) patterns.push(pattern);
  }

  for (const [key, value] of Object.entries(node)) {
    if (["loc", "range", "tokens", "comments"].includes(key)) continue;
    if (Array.isArray(value)) {
      for (const item of value) collectIdPatterns(item, patterns);
    } else if (value && typeof value === "object") {
      collectIdPatterns(value, patterns);
    }
  }
  return patterns;
}

function verifyLegacyBaseline(filePath, counts, nativeTableCount) {
  const relativePath = path.relative(ROOT, filePath).replaceAll("\\", "/");
  const baseline = {
    ...(LEGACY_UI_BASELINE[relativePath] || {}),
    ...(LEGACY_SURFACE_BASELINE[relativePath] || {}),
    ...(LEGACY_COLLECTION_BASELINE[relativePath] || {})
  };
  for (const [token, count] of Object.entries(counts)) {
    const ceiling = baseline[token] || 0;
    if (count > ceiling) {
      failures.push({
        file: relativePath,
        line: 1,
        message: token === "button"
          ? `Numărul de butoane native fără className a crescut peste baseline (${ceiling} → ${count}).`
          : `Clasa legacy ${token} a crescut peste baseline (${ceiling} → ${count}).`
      });
    }
  }

  const tableCeiling = NATIVE_TABLE_BASELINE[relativePath] || 0;
  if (nativeTableCount > tableCeiling) {
    failures.push({
      file: relativePath,
      line: 1,
      message: `Numărul de tabele native a crescut peste baseline (${tableCeiling} → ${nativeTableCount}). Planifică migrarea prin patternul canonic înainte de a adăuga alt tabel.`
    });
  }
}

for (const filePath of sourceFiles) {
  const source = fs.readFileSync(filePath, "utf8");
  const relativePath = path.relative(ROOT, filePath).replaceAll("\\", "/");
  if (source.includes("@/components/filter-controls")) {
    failures.push({
      file: relativePath,
      line: source.slice(0, source.indexOf("@/components/filter-controls")).split("\n").length,
      message: "Importul legacy components/filter-controls a fost retras; folosește components/ui/collection-controls."
    });
  }
  for (const [exportName, canonicalPath] of Object.entries(CANONICAL_EXPORT_PATHS)) {
    const exportPattern = new RegExp(`\\bexport\\s+(?:const|function|class)\\s+${exportName}\\b`);
    if (exportPattern.test(source) && relativePath !== canonicalPath) {
      failures.push({
        file: relativePath,
        line: source.slice(0, source.search(exportPattern)).split("\n").length,
        message: `${exportName} poate fi exportat numai din ${canonicalPath}.`
      });
    }
  }
  for (const [componentName, allowedPaths] of Object.entries(CANONICAL_PATTERN_DEFINITION_ALLOWLIST)) {
    const definitionPattern = new RegExp(`\\b(?:function|const|class)\\s+${componentName}\\b`);
    if (definitionPattern.test(source) && !allowedPaths.has(relativePath)) {
      failures.push({
        file: relativePath,
        line: source.slice(0, source.search(definitionPattern)).split("\n").length,
        message: `${componentName} poate fi definit numai în componenta canonică sau într-un consumator legacy allowlisted.`
      });
    }
  }
  const mojibakeToken = MOJIBAKE_TOKENS.find((token) => source.includes(token));
  if (mojibakeToken) {
    const index = source.indexOf(mojibakeToken);
    failures.push({
      file: path.relative(ROOT, filePath).replaceAll("\\", "/"),
      line: source.slice(0, index).split("\n").length,
      message: `Text posibil corupt de encoding: ${JSON.stringify(mojibakeToken)}`
    });
  }

  try {
    const ast = parse(source, {
      sourceType: "module",
      ecmaVersion: "latest",
      ecmaFeatures: { jsx: true },
      requireConfigFile: false,
      filePath,
      babelOptions: {
        filename: filePath,
        parserOpts: { plugins: ["jsx"] }
      }
    });
    const context = {
      ids: collectStaticIds(ast),
      idPatterns: collectIdPatterns(ast),
      labelTargets: collectLabelTargets(ast),
      legacyCounts: {},
      nativeTableCount: 0
    };
    traverse(filePath, ast, context);
    verifyLegacyBaseline(filePath, context.legacyCounts, context.nativeTableCount);
  } catch (error) {
    report(filePath, error, `Fisierul nu a putut fi analizat: ${error.message}`);
  }
}

if (failures.length) {
  console.error("UI static check failed:\n");
  for (const failure of failures) {
    console.error(`- ${failure.file}:${failure.line} ${failure.message}`);
  }
  process.exit(1);
}

console.log(`UI static check passed (${sourceFiles.length} fisiere, ${routePatterns.length} rute).`);
