import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { parse } = require("next/dist/compiled/babel/eslint-parser");

const ROOT = process.cwd();
const SOURCE_ROOTS = ["app", "components"];
const ROUTE_ALIASES = [/^\/materiale(?:\/.*)?$/];
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
  const className = staticAttributeValue(getAttribute(opening, "className")) || "";

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

  if (name === "button" && !hasAccessibleAttribute(opening) && !hasPotentialText(node.children)) {
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

for (const filePath of sourceFiles) {
  const source = fs.readFileSync(filePath, "utf8");
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
    traverse(filePath, ast, {
      ids: collectStaticIds(ast),
      idPatterns: collectIdPatterns(ast),
      labelTargets: collectLabelTargets(ast)
    });
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
