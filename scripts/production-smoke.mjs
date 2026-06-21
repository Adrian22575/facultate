const DEFAULT_BASE_URL = "https://www.nota5plus.ro";
const PUBLIC_PATHS = ["/", "/despre", "/preturi", "/confidentialitate", "/termeni"];
const PRIVATE_PATHS = ["/cont", "/materiale/invata"];
const REQUIRED_SECURITY_HEADERS = [
  "content-security-policy",
  "permissions-policy",
  "referrer-policy",
  "strict-transport-security",
  "x-content-type-options",
  "x-frame-options"
];
const LEGAL_PLACEHOLDERS = [
  "De completat inainte de lansare",
  "de completat inainte de lansare"
];
const PRIVATE_SITEMAP_PREFIXES = [
  "/admin",
  "/ai",
  "/api",
  "/auth",
  "/billing",
  "/cont",
  "/demo",
  "/licenta-exam",
  "/materiale",
  "/materii",
  "/onboarding",
  "/setup",
  "/statistici",
  "/testele-mele"
];

function readArgument(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? "" : process.argv[index + 1] || "";
}

function normalizeBaseUrl(value) {
  const url = new URL(value || DEFAULT_BASE_URL);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error("Base URL must use http or https.");
  }
  return url.origin;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    return await fetch(url, {
      ...options,
      headers: {
        "user-agent": "Nota5Plus-Production-Smoke/1.0",
        ...options.headers
      },
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

const checks = [];

async function check(name, callback) {
  try {
    await callback();
    checks.push({ name, ok: true });
    console.log(`PASS ${name}`);
  } catch (error) {
    checks.push({ name, ok: false, message: error instanceof Error ? error.message : String(error) });
    console.error(`FAIL ${name}: ${checks.at(-1).message}`);
  }
}

let baseUrl;
try {
  baseUrl = normalizeBaseUrl(readArgument("--base-url") || process.env.NEXT_PUBLIC_SITE_URL);
} catch (error) {
  console.error(`Invalid --base-url: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

const requestedBaseUrl = baseUrl;
try {
  const canonicalResponse = await fetchWithTimeout(requestedBaseUrl);
  baseUrl = new URL(canonicalResponse.url || requestedBaseUrl).origin;
} catch {
  // The individual checks below preserve the useful per-route failure report.
}

console.log(`Production smoke target: ${baseUrl}`);
if (baseUrl !== requestedBaseUrl) {
  console.log(`Canonical origin discovered from ${requestedBaseUrl}`);
}

for (const path of PUBLIC_PATHS) {
  await check(`public page ${path}`, async () => {
    const response = await fetchWithTimeout(`${baseUrl}${path}`);
    assert(response.status === 200, `expected 200, received ${response.status}`);
    assert(response.headers.get("content-type")?.includes("text/html"), "response is not HTML");
  });
}

await check("custom not-found page", async () => {
  const response = await fetchWithTimeout(`${baseUrl}/pagina-inexistenta-smoke-404`);
  const html = await response.text();
  assert(response.status === 404, `expected 404, received ${response.status}`);
  assert(html.includes("Pagina aceasta nu mai este aici."), "custom Romanian 404 content is missing");
  assert(/<meta[^>]+name=["']robots["'][^>]+noindex/i.test(html), "404 page is missing noindex metadata");
});

await check("security headers", async () => {
  const response = await fetchWithTimeout(baseUrl);
  const missing = REQUIRED_SECURITY_HEADERS.filter((header) => !response.headers.get(header));
  assert(missing.length === 0, `missing: ${missing.join(", ")}`);
});

await check("legal pages contain final operator data", async () => {
  for (const path of ["/confidentialitate", "/termeni"]) {
    const response = await fetchWithTimeout(`${baseUrl}${path}`);
    assert(response.status === 200, `${path} returned ${response.status}`);
    const html = await response.text();
    const placeholder = LEGAL_PLACEHOLDERS.find((value) => html.includes(value));
    assert(!placeholder, `${path} still contains legal placeholder text`);
  }
});

for (const path of PRIVATE_PATHS) {
  await check(`private route ${path}`, async () => {
    const response = await fetchWithTimeout(`${baseUrl}${path}`, { redirect: "manual" });
    assert([301, 302, 303, 307, 308].includes(response.status), `expected redirect, received ${response.status}`);
    const location = response.headers.get("location") || "";
    assert(location.includes("/auth/login"), `redirect does not lead to login: ${location || "missing location"}`);
    assert(
      response.headers.get("x-robots-tag")?.includes("noindex"),
      "X-Robots-Tag noindex is missing"
    );
  });
}

await check("sitemap exposes only public canonical URLs", async () => {
  const response = await fetchWithTimeout(`${baseUrl}/sitemap.xml`);
  assert(response.status === 200, `expected 200, received ${response.status}`);
  const xml = await response.text();
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  const paths = urls.map((value) => new URL(value).pathname.replace(/\/$/, "") || "/");
  for (const expectedPath of PUBLIC_PATHS) {
    assert(paths.includes(expectedPath), `public route is missing: ${expectedPath}`);
  }
  assert(new Set(urls).size === urls.length, "duplicate URLs found");

  for (const value of urls) {
    const url = new URL(value);
    assert(url.origin === baseUrl, `non-canonical origin found: ${url.origin}`);
    assert(!value.slice(url.protocol.length + 2).includes("//"), `double slash found: ${value}`);
    assert(
      !PRIVATE_SITEMAP_PREFIXES.some((prefix) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`)),
      `private route found: ${url.pathname}`
    );
  }
});

await check("robots policy", async () => {
  const response = await fetchWithTimeout(`${baseUrl}/robots.txt`);
  assert(response.status === 200, `expected 200, received ${response.status}`);
  const body = await response.text();
  assert(body.includes(`Sitemap: ${baseUrl}/sitemap.xml`), "canonical sitemap URL is missing");
  assert(body.includes("Disallow: /cont"), "private account route is not disallowed");
  assert(body.includes("Disallow: /materiale"), "private workspace route is not disallowed");
});

await check("application health", async () => {
  const response = await fetchWithTimeout(`${baseUrl}/api/health`);
  const body = await response.json().catch(() => null);
  assert(response.status === 200, `expected 200, received ${response.status}`);
  assert(body?.status === "ok", "health response is not ok");
  assert(typeof body?.release === "string" && body.release.length > 0, "health response has no release id");
  assert(response.headers.get("cache-control")?.includes("no-store"), "health response can be cached");

  const expectedCommit = readArgument("--expected-commit").trim().slice(0, 12);
  if (expectedCommit) {
    assert(body.release === expectedCommit, `expected release ${expectedCommit}, received ${body.release}`);
  }
});

const failed = checks.filter((item) => !item.ok);
console.log(`\nResult: ${checks.length - failed.length}/${checks.length} checks passed.`);
if (failed.length) process.exit(1);
