import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createLinkedInPostWithConfig, exchangeLinkedInCodeWithConfig, getLinkedInUserInfoWithFetch } from "../lib/linkedin/client-core.js";
import { normalizeLinkedInModel } from "../lib/linkedin/models.js";
import { buildLinkedInFullPost, hashOAuthState, isConnectionUsable, validateLinkedInDraft } from "../lib/linkedin/shared.js";
import { DEFAULT_LINKEDIN_POST_TEMPLATE, getLinkedInPostTemplate, LINKEDIN_POST_TEMPLATES } from "../lib/linkedin/templates.js";

const config = { clientId: "client", clientSecret: "secret", redirectUri: "https://nota5plus.ro/api/admin/linkedin/oauth/callback", apiVersion: "202606" };
const article = {
  id: "11111111-1111-4111-8111-111111111111",
  slug: "schimbari-concrete-in-educatie",
  title: "Schimbări concrete în educație",
  subtitle: "Calendarul și regulile publicate pentru noul an universitar.",
  summary: "Ministerul a publicat calendarul examenelor pentru luna iulie. Universitățile pot adapta datele în limitele regulamentelor proprii.",
  key_takeaways: ["Calendarul examenelor a fost publicat pentru luna iulie."],
  sections: [{ title: "Calendarul", content: "Ministerul a publicat calendarul examenelor pentru luna iulie. Studenții trebuie să verifice și pagina universității.", keyClaims: ["Ministerul a publicat calendarul examenelor pentru luna iulie."] }],
  student_implications: ["Studenții trebuie să verifice și pagina universității."],
  conclusion: "Datele oficiale oferă reperul comun, iar fiecare universitate publică detaliile proprii."
};
const articleUrl = `https://nota5plus.ro/articole/${article.slug}`;

function validDraft(overrides = {}) {
  const base = {
    hook: "Calendarul examenelor din iulie schimbă planificarea pentru studenți.",
    body: "Ministerul a publicat calendarul, iar universitățile păstrează responsabilitatea detaliilor locale. Pentru studenți, verificarea paginii facultății rămâne pasul practic înainte de organizarea sesiunii.",
    articleUrl,
    closingQuestion: "Ce informație ar trebui publicată prima de fiecare facultate pentru ca studenții să își poată planifica sesiunea?",
    hashtags: ["#Educatie", "#Studenti", "#Digitalizare"],
    tone: "profesional-analitic",
    claims: ["Ministerul a publicat calendarul examenelor pentru luna iulie.", "Studenții trebuie să verifice și pagina universității."],
    sourceArticleId: article.id
  };
  const merged = { ...base, ...overrides };
  if (!merged.body.includes(merged.hashtags[0])) merged.body = `${merged.body}\n\n${merged.hashtags.join(" ")}`;
  merged.fullPost = overrides.fullPost || buildLinkedInFullPost(merged);
  merged.characterCount = overrides.characterCount ?? merged.fullPost.length;
  return merged;
}

test("validează draftul structurat și reconstruiește textul canonic", () => {
  const result = validateLinkedInDraft(validDraft(), { article, articleUrl });
  assert.equal(result.valid, true);
  assert.equal(result.draft.articleUrl, articleUrl);
  assert.equal(result.draft.characterCount, result.draft.fullPost.length);
});

test("recalculates canonical character count", () => {
  const result = validateLinkedInDraft(validDraft({ characterCount: 1 }), { article, articleUrl });
  assert.equal(result.valid, true);
  assert.equal(result.draft.characterCount, result.draft.fullPost.length);
});

test("normalizeaza aliasul GPT-5.6 la Sol si accepta numai modelele disponibile", () => {
  assert.equal(normalizeLinkedInModel("gpt-5.6"), "gpt-5.6-sol");
  assert.equal(normalizeLinkedInModel("gpt-5.6-terra"), "gpt-5.6-terra");
  assert.equal(normalizeLinkedInModel("unrecognized-model"), "gpt-5.6-sol");
});

test("formatele LinkedIn sunt finite, au un implicit sigur si hashtagurile raman in text", () => {
  assert.equal(LINKEDIN_POST_TEMPLATES.length, 5);
  assert.equal(getLinkedInPostTemplate("missing").key, DEFAULT_LINKEDIN_POST_TEMPLATE);
  const draft = validDraft();
  assert.equal(draft.fullPost.endsWith(draft.hashtags.join(" ")), false);
  assert.equal(validateLinkedInDraft(draft, { article, articleUrl }).valid, true);
});

test("respinge informațiile care nu există în articol și întrebările generice", () => {
  const unsupported = validateLinkedInDraft(validDraft({ claims: ["Bugetul educației a crescut cu 40%.", "Studenții trebuie să verifice și pagina universității."] }), { article, articleUrl });
  assert.equal(unsupported.valid, false);
  assert.match(unsupported.reasons.join(" "), /unsupported_claim/);
  const generic = validateLinkedInDraft(validDraft({ closingQuestion: "Ce părere aveți despre asta?" }), { article, articleUrl });
  assert.equal(generic.valid, false);
  assert.ok(generic.reasons.includes("generic_closing_question"));

  const wrongUrl = validateLinkedInDraft(validDraft({ articleUrl: "not-a-public-article-url" }), { article, articleUrl });
  assert.equal(wrongUrl.valid, false);
  assert.ok(wrongUrl.reasons.includes("article_url_mismatch"));
});

test("consideră conexiunea utilizabilă numai cu scope și token neexpirat", () => {
  const valid = { status: "connected", scopes: ["openid", "profile", "w_member_social"], token_expires_at: "2026-09-01T00:00:00.000Z" };
  assert.equal(isConnectionUsable(valid, new Date("2026-07-18T12:00:00.000Z")), true);
  assert.equal(isConnectionUsable({ ...valid, token_expires_at: "2026-07-18T11:00:00.000Z" }, new Date("2026-07-18T12:00:00.000Z")), false);
  assert.equal(isConnectionUsable({ ...valid, scopes: ["openid", "profile"] }, new Date("2026-07-18T12:00:00.000Z")), false);
  assert.equal(isConnectionUsable({ ...valid, status: "disconnected" }, new Date("2026-07-18T12:00:00.000Z")), false);
});

test("hash-ul OAuth state detectează o valoare diferită", () => {
  assert.equal(hashOAuthState("state-valid"), hashOAuthState("state-valid"));
  assert.notEqual(hashOAuthState("state-valid"), hashOAuthState("state-modificat"));
});

test("schimbul OAuth folosește endpointul oficial și nu expune secretul în rezultat", async () => {
  let request;
  const result = await exchangeLinkedInCodeWithConfig("authorization-code", config, { fetchImpl: async (url, options) => {
    request = { url, options };
    return new Response(JSON.stringify({ access_token: "token", expires_in: 5184000, scope: "openid profile w_member_social" }), { status: 200, headers: { "content-type": "application/json" } });
  } });
  assert.equal(request.url, "https://www.linkedin.com/oauth/v2/accessToken");
  assert.match(String(request.options.body), /grant_type=authorization_code/);
  assert.deepEqual(result.scopes, ["openid", "profile", "w_member_social"]);
  assert.equal(Object.hasOwn(result, "clientSecret"), false);
});

test("callbackul de profil construiește URN-ul exclusiv din userinfo", async () => {
  const profile = await getLinkedInUserInfoWithFetch("token", { fetchImpl: async () => new Response(JSON.stringify({ sub: "member_123", name: "Ada Popescu" }), { status: 200, headers: { "content-type": "application/json" } }) });
  assert.equal(profile.memberUrn, "urn:li:person:member_123");
  assert.equal(profile.name, "Ada Popescu");
});

test("publicarea folosește Posts API, antetele obligatorii și autor personal", async () => {
  let request;
  const result = await createLinkedInPostWithConfig({ accessToken: "token", authorUrn: "urn:li:person:member_123", text: validDraft().fullPost }, config, { fetchImpl: async (url, options) => {
    request = { url, options };
    return new Response(null, { status: 201, headers: { "x-restli-id": "urn:li:share:123456789" } });
  } });
  const body = JSON.parse(request.options.body);
  assert.equal(request.url, "https://api.linkedin.com/rest/posts");
  assert.equal(request.options.headers["linkedin-version"], "202606");
  assert.equal(request.options.headers["x-restli-protocol-version"], "2.0.0");
  assert.equal(body.author, "urn:li:person:member_123");
  assert.equal(body.lifecycleState, "PUBLISHED");
  assert.equal(result.postUrn, "urn:li:share:123456789");
});

test("tratează tokenul revocat și răspunsul ambiguu fără retry automat", async () => {
  await assert.rejects(() => createLinkedInPostWithConfig({ accessToken: "bad", authorUrn: "urn:li:person:x", text: validDraft().fullPost }, config, { fetchImpl: async () => new Response(null, { status: 401 }) }), (error) => error.code === "linkedin_connection_expired" && error.retryable === false);
  await assert.rejects(() => createLinkedInPostWithConfig({ accessToken: "token", authorUrn: "urn:li:person:x", text: validDraft().fullPost }, config, { fetchImpl: async () => { throw new Error("network"); } }), (error) => error.code === "linkedin_publish_result_unknown" && error.ambiguous === true && error.retryable === false);
});

test("schema impune idempotency, RLS și lipsa accesului client", async () => {
  const migration = await readFile(new URL("../supabase/migrations/20260718143000_linkedin_editorial_distribution.sql", import.meta.url), "utf8");
  assert.match(migration, /unique \(article_id, connection_id\)/i);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /revoke all on table public\.linkedin_connections from public, anon, authenticated/i);
  assert.match(migration, /access_token_encrypted/i);
});

test("rutele admin verifică autentificarea și notificările nu includ tokenuri", async () => {
  const [actionsRoute, callbackRoute, telegram, server] = await Promise.all([
    readFile(new URL("../app/api/admin/linkedin/posts/[postId]/actions/route.js", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/linkedin/oauth/callback/route.js", import.meta.url), "utf8"),
    readFile(new URL("../lib/notifications/telegram.js", import.meta.url), "utf8"),
    readFile(new URL("../lib/linkedin/server.js", import.meta.url), "utf8")
  ]);
  assert.match(actionsRoute, /isAdminUser/);
  assert.match(callbackRoute, /invalid_state/);
  assert.match(callbackRoute, /encryptLinkedInToken/);
  assert.match(server, /linkedin_publish_confirmation_persistence_failed/);
  assert.match(server, /post\.status === "publishing"/);
  const linkedinNotificationSection = telegram.slice(telegram.indexOf("notifyLinkedInDraftReady"), telegram.indexOf("getAdminNotificationEventsSnapshot"));
  assert.match(linkedinNotificationSection, /notifyLinkedInPublished/);
  assert.doesNotMatch(linkedinNotificationSection, /access_token|client_secret/i);
});

test("respinge structured output invalid, placeholder-ele si formularile interzise", () => {
  const invalidStructure = validateLinkedInDraft({ hook: "prea scurt" }, { article, articleUrl });
  assert.deepEqual(invalidStructure.reasons, ["structured_output_invalid"]);

  const placeholder = validateLinkedInDraft(validDraft({
    body: "Ministerul a publicat calendarul, iar universitatile pastreaza responsabilitatea detaliilor locale. Pentru studenti, verificarea paginii facultatii ramane pasul practic. Vezi [LINK ARTICOL] pentru detalii suplimentare."
  }), { article, articleUrl });
  assert.ok(placeholder.reasons.includes("placeholder_detected"));

  const banned = validateLinkedInDraft(validDraft({
    hook: "Viitorul este deja aici, iar calendarul examenelor schimba planificarea."
  }), { article, articleUrl });
  assert.ok(banned.reasons.includes("banned_language_detected"));

  const invalidHashtag = validateLinkedInDraft(validDraft({ hashtags: ["#Educatie", "fara_diez", "#Studenti"] }), { article, articleUrl });
  assert.ok(invalidHashtag.reasons.includes("invalid_hashtag"));
});

test("OAuth cere state si permisiunile minime, iar callbackul consuma state o singura data", async () => {
  const [configSource, startRoute, callbackRoute, middleware] = await Promise.all([
    readFile(new URL("../lib/linkedin/config.js", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/linkedin/oauth/start/route.js", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/linkedin/oauth/callback/route.js", import.meta.url), "utf8"),
    readFile(new URL("../middleware.js", import.meta.url), "utf8")
  ]);
  assert.match(configSource, /\["openid", "profile", "w_member_social"\]/);
  assert.match(configSource, /searchParams\.set\("state", state\)/);
  assert.match(configSource, /searchParams\.set\("redirect_uri", config\.redirectUri\)/);
  assert.match(startRoute, /randomBytes\(32\)/);
  assert.match(startRoute, /hashOAuthState\(state\)/);
  assert.match(callbackRoute, /\.is\("used_at", null\)/);
  assert.match(callbackRoute, /\.gt\("expires_at", now\)/);
  assert.match(callbackRoute, /authorization_cancelled/);
  assert.match(callbackRoute, /callback_failed/);
  assert.match(middleware, /api\/admin\/linkedin\/oauth\/callback/);
});

test("schimbul OAuth si profilul trateaza raspunsurile esuate", async () => {
  await assert.rejects(
    () => exchangeLinkedInCodeWithConfig("bad-code", config, { fetchImpl: async () => new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400, headers: { "content-type": "application/json" } }) }),
    (error) => error.code === "linkedin_token_exchange_failed" && error.status === 400
  );
  await assert.rejects(
    () => getLinkedInUserInfoWithFetch("bad-token", { fetchImpl: async () => new Response(JSON.stringify({ message: "denied" }), { status: 403, headers: { "content-type": "application/json" } }) }),
    (error) => error.code === "linkedin_profile_lookup_failed" && error.status === 403
  );
});

test("Posts API clasifica rate limitul si confirmarea lipsa fara a produce duplicate", async () => {
  await assert.rejects(
    () => createLinkedInPostWithConfig({ accessToken: "token", authorUrn: "urn:li:person:x", text: validDraft().fullPost }, config, { fetchImpl: async () => new Response(null, { status: 429 }) }),
    (error) => error.code === "linkedin_publish_failed" && error.retryable === true && error.ambiguous === false
  );
  await assert.rejects(
    () => createLinkedInPostWithConfig({ accessToken: "token", authorUrn: "urn:li:person:x", text: validDraft().fullPost }, config, { fetchImpl: async () => new Response(null, { status: 201 }) }),
    (error) => error.code === "linkedin_publish_confirmation_missing" && error.ambiguous === true
  );
});

test("fluxurile draft, aprobare, respingere, auto-publicare si articol nepublicat sunt impuse pe server", async () => {
  const [server, actionRoute, publishHook] = await Promise.all([
    readFile(new URL("../lib/linkedin/server.js", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/linkedin/posts/[postId]/actions/route.js", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/editorial/articles/[articleId]/actions/route.js", import.meta.url), "utf8")
  ]);
  assert.match(server, /settings\.mode === "approval_required" \? "pending_approval"/);
  assert.match(server, /settings\.mode === "auto_publish" \? "approved"/);
  assert.match(server, /if \(settings\.mode === "auto_publish"\) return publishLinkedInPost/);
  assert.match(server, /if \(data\.status !== "published"\) throw new Error\("article_not_published"\)/);
  assert.match(server, /if \(post\.article\?\.status !== "published"\) throw new Error\("article_not_published"\)/);
  assert.match(actionRoute, /approveLinkedInPost/);
  assert.match(actionRoute, /rejectLinkedInPost/);
  assert.match(actionRoute, /publishLinkedInPost/);
  assert.match(actionRoute, /prepareLinkedInDraft/);
  assert.match(publishHook, /after\(async \(\) =>/);
  assert.match(publishHook, /prepareLinkedInDraft\(article\.id\)/);
});

test("retry-ul este blocat pentru rezultate ambigue si concurenta revendica o singura publicare", async () => {
  const [server, actionsRoute] = await Promise.all([
    readFile(new URL("../lib/linkedin/server.js", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/linkedin/posts/[postId]/actions/route.js", import.meta.url), "utf8")
  ]);
  assert.match(server, /linkedin_retry_blocked_ambiguous_result/);
  assert.match(server, /\.in\("status", \["approved", "failed"\]\)/);
  assert.match(server, /reason: "already_published"/);
  assert.match(server, /reason: "already_publishing"/);
  assert.match(actionsRoute, /linkedin_publish_confirmation_persistence_failed/);
});

test("fallback-ul sigur ramane text plus link cat timp imaginea editoriala nu este eligibila", async () => {
  const [migration, server, client] = await Promise.all([
    readFile(new URL("../supabase/migrations/20260718143000_linkedin_editorial_distribution.sql", import.meta.url), "utf8"),
    readFile(new URL("../lib/linkedin/server.js", import.meta.url), "utf8"),
    readFile(new URL("../lib/linkedin/client-core.js", import.meta.url), "utf8")
  ]);
  assert.match(migration, /include_article_image boolean not null default false/i);
  assert.match(migration, /fallback_to_text boolean not null default true/i);
  assert.match(server, /include_article_image: false/);
  assert.match(server, /fallback_to_text: true/);
  assert.match(client, /commentary: text/);
  assert.doesNotMatch(client, /imagesApi|vectorImage|registerUpload/i);
});

test("toate rutele de administrare sunt protejate, iar UI-ul expune actiunile cerute", async () => {
  const routeUrls = [
    "../app/api/admin/linkedin/settings/route.js",
    "../app/api/admin/linkedin/articles/[articleId]/generate/route.js",
    "../app/api/admin/linkedin/posts/[postId]/route.js",
    "../app/api/admin/linkedin/posts/[postId]/actions/route.js",
    "../app/api/admin/linkedin/connections/[connectionId]/disconnect/route.js"
  ];
  const routes = await Promise.all(routeUrls.map((url) => readFile(new URL(url, import.meta.url), "utf8")));
  for (const route of routes) {
    assert.match(route, /isAdminUser/);
    assert.match(route, /unauthorized|auth\/login/);
  }
  const ui = await readFile(new URL("../components/admin-linkedin-distribution.js", import.meta.url), "utf8");
  const normalizedUi = ui.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  for (const label of ["Conecteaz", "Deconecteaz", "Aprob", "Respinge", "Public", "Reincearca", "Deschide pe LinkedIn"]) {
    assert.match(normalizedUi, new RegExp(label, "i"));
  }
});
