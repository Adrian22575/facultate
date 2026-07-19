import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  ADMIN_ROUTE_GROUPS,
  ADMIN_ROUTES,
  getAdminRoute,
  getLegacyAdminRedirect
} from "../lib/admin-routes.js";

test("Admin are o hartă unică de subpagini, cu maximum două niveluri", () => {
  assert.equal(ADMIN_ROUTE_GROUPS.length, 6);
  assert.equal(ADMIN_ROUTES.length, 16);
  assert.equal(new Set(ADMIN_ROUTES.map((route) => route.path)).size, ADMIN_ROUTES.length);

  for (const route of ADMIN_ROUTES) {
    assert.match(route.path, /^\/admin\/[^/]+\/[^/]+$/);
    assert.ok(route.label);
    assert.ok(route.description);
    assert.equal(getAdminRoute(route.path)?.id, route.id);
    assert.equal(getAdminRoute(route.path.split("/").slice(2))?.path, route.path);
  }
});

test("zonele cu risc operațional au destinații canonice clare", () => {
  assert.equal(getAdminRoute("/admin/continut/linkedin")?.pane, "linkedin");
  assert.equal(getAdminRoute("/admin/financiar/evenimente-plati")?.billingView, "webhooks");
  assert.equal(getAdminRoute("/admin/catalog/facultati")?.academicView, "faculties");
  assert.equal(getAdminRoute("/admin/operatiuni/procesari")?.kind, "processing");
  assert.equal(getAdminRoute("/admin/necunoscut/pagina"), null);
});

test("URL-urile Admin vechi sunt redirecționate și își păstrează contextul", () => {
  assert.equal(
    getLegacyAdminRedirect({ admin_tab: "dictionary" }),
    "/admin/continut/dictionar"
  );
  assert.equal(
    getLegacyAdminRedirect({ admin_tab: "editorial", linkedin_post: "post-42" }),
    "/admin/continut/linkedin?linkedin_post=post-42"
  );
  assert.equal(
    getLegacyAdminRedirect({ section: "editorial" }),
    "/admin/continut/articole"
  );
  assert.equal(
    getLegacyAdminRedirect({ section: "billing", billing: "credits", billing_q: "ana@example.ro" }),
    "/admin/financiar/credite?billing_q=ana%40example.ro"
  );
  assert.equal(
    getLegacyAdminRedirect({ section: "academic", academic_tab: "faculties", faculty_institution: "inst-7" }),
    "/admin/catalog/facultati?faculty_institution=inst-7"
  );
  assert.equal(getLegacyAdminRedirect({}), null);
});

test("Admin păstrează o singură navigație persistentă și încarcă selectiv", async () => {
  const [shell, switcher, editorial, linkedIn, subpage, overview] = await Promise.all([
    readFile(new URL("../components/admin-page-shell.js", import.meta.url), "utf8"),
    readFile(new URL("../components/admin-route-switcher.js", import.meta.url), "utf8"),
    readFile(new URL("../components/admin-editorial-panel.js", import.meta.url), "utf8"),
    readFile(new URL("../components/admin-linkedin-distribution.js", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/[...adminPath]/page.js", import.meta.url), "utf8"),
    readFile(new URL("../components/admin-overview.js", import.meta.url), "utf8")
  ]);

  assert.match(shell, /aria-current=.*page/);
  assert.match(shell, /aria-label="Locație Admin"/);
  assert.match(shell, /AdminRouteSwitcher/);
  assert.doesNotMatch(shell, /admin-route-sidebar/);
  assert.match(switcher, /<optgroup/);
  assert.match(switcher, /router\.push/);
  assert.match(overview, /ADMIN_ROUTE_GROUPS\.map/);
  assert.match(subpage, /if \(route\.section === "feedback"\)/);
  assert.match(subpage, /if \(route\.section === "analytics"\)/);
  assert.match(subpage, /showSectionNavigation=\{false\}/);
  assert.match(subpage, /fixedPane=\{route\.pane\}/);
  assert.match(subpage, /key=\{route\.path\}/);
  assert.match(editorial, /const visiblePane = fixedPane/);
  assert.match(editorial, /admin-editorial-picker/);
  assert.doesNotMatch(editorial, /admin-editorial-tabs/);
  assert.match(linkedIn, /className="admin-linkedin-list" role="group"/);
  assert.doesNotMatch(linkedIn, /<nav className="admin-linkedin-list"/);
  assert.match(linkedIn, /timeZone: "Europe\/Bucharest"/);
});
