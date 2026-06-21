import assert from "node:assert/strict";

import { getPostLoginNextPath, getSafeNextPath } from "../lib/auth/password-auth.js";

assert.equal(getSafeNextPath("/materii/economie?tab=test#rezultat"), "/materii/economie?tab=test#rezultat");
assert.equal(getSafeNextPath("https://example.com"), "/");
assert.equal(getSafeNextPath("//example.com/path"), "/");
assert.equal(getSafeNextPath("/\\example.com/path"), "/");
assert.equal(getSafeNextPath("  /materiale/invata  "), "/materiale/invata");

assert.equal(getPostLoginNextPath("/auth/login"), "/");
assert.equal(getPostLoginNextPath("/auth/signout?next=/"), "/");
assert.equal(getPostLoginNextPath("/api/account"), "/");
assert.equal(getPostLoginNextPath("/_next/static/chunk.js"), "/");
assert.equal(getPostLoginNextPath("/onboarding?next=%2Fmateriale"), "/onboarding?next=%2Fmateriale");
assert.equal(getPostLoginNextPath("/materiale/licenta/abc"), "/materiale/licenta/abc");

console.log("auth:flow:check ok");
