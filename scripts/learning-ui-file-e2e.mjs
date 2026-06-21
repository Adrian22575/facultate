import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  DOCX_MIME,
  PPTX_MIME,
  createDocxBuffer,
  createPdfBuffer,
  createPptxBuffer,
  sampleLearningText
} from "./learning-fixtures.mjs";

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};

  const env = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index < 0) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

Object.assign(process.env, loadEnvFile(".env.local"), process.env);

function parseArguments(argv) {
  const labels = [];
  let baseUrl = process.env.LEARNING_UI_BASE_URL || "http://localhost:3000";

  for (let index = 2; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--base-url") {
      baseUrl = argv[index + 1] || "";
      index += 1;
      continue;
    }
    labels.push(value.trim().toUpperCase());
  }

  const parsedUrl = new URL(baseUrl);
  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("base_url_must_use_http_or_https");
  }

  return {
    baseUrl: parsedUrl.origin,
    labels: labels.filter(Boolean)
  };
}

const cli = parseArguments(process.argv);

function edgeExecutablePath() {
  const candidates = [
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
  ];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) throw new Error("msedge_not_found");
  return found;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(predicate, { timeoutMs = 30000, intervalMs = 250, label = "condition" } = {}) {
  const startedAt = Date.now();
  let lastError = null;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const result = await predicate();
      if (result) return result;
    } catch (error) {
      lastError = error;
    }
    await delay(intervalMs);
  }

  throw new Error(`timeout_waiting_for_${label}${lastError ? `: ${lastError.message}` : ""}`);
}

class CdpSession {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    this.events = [];

    ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message || JSON.stringify(message.error)));
        else resolve(message.result || {});
        return;
      }
      if (message.method) this.events.push(message);
    });
  }

  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((resolve, reject) => {
      ws.addEventListener("open", resolve, { once: true });
      ws.addEventListener("error", reject, { once: true });
    });
    return new CdpSession(ws);
  }

  send(method, params = {}) {
    const id = this.nextId++;
    const payload = JSON.stringify({ id, method, params });
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(payload);
    });
  }

  close() {
    this.ws.close();
  }
}

async function launchBrowser() {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "learning-ui-file-e2e-"));
  const remoteDebuggingPort = 9233 + Math.floor(Math.random() * 400);
  const edge = spawn(edgeExecutablePath(), [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    `--remote-debugging-port=${remoteDebuggingPort}`,
    `--user-data-dir=${userDataDir}`,
    "--window-size=1366,1600",
    "about:blank"
  ], {
    stdio: "ignore",
    windowsHide: true
  });

  const version = await waitFor(async () => {
    const response = await fetch(`http://127.0.0.1:${remoteDebuggingPort}/json/version`).catch(() => null);
    if (!response?.ok) return null;
    return response.json();
  }, { timeoutMs: 15000, label: "devtools" });

  const session = await CdpSession.connect(version.webSocketDebuggerUrl);
  await session.send("Page.enable");
  await session.send("Runtime.enable");
  await session.send("DOM.enable");

  return { edge, userDataDir, remoteDebuggingPort, session };
}

async function evaluate(session, expression, { awaitPromise = true } = {}) {
  const result = await session.send("Runtime.evaluate", {
    expression,
    awaitPromise,
    returnByValue: true
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || "runtime_evaluate_failed");
  }
  return result.result?.value;
}

async function navigate(session, url) {
  await session.send("Page.navigate", { url });
  await waitFor(
    () => evaluate(session, "document.readyState === 'complete'"),
    { timeoutMs: 20000, label: `load_${url}` }
  );
}

async function queryNodeId(session, selector) {
  const { root } = await session.send("DOM.getDocument", { depth: -1, pierce: true });
  const { nodeId } = await session.send("DOM.querySelector", {
    nodeId: root.nodeId,
    selector
  });
  if (!nodeId) throw new Error(`selector_not_found_${selector}`);
  return nodeId;
}

function jsString(value) {
  return JSON.stringify(String(value));
}

async function click(session, selector) {
  await evaluate(session, `
    (() => {
      const element = document.querySelector(${jsString(selector)});
      if (!element) throw new Error("missing ${selector}");
      element.click();
      return true;
    })()
  `);
}

async function fill(session, selector, value) {
  await evaluate(session, `
    (() => {
      const element = document.querySelector(${jsString(selector)});
      if (!element) throw new Error("missing ${selector}");
      element.value = ${jsString(value)};
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    })()
  `);
}

async function createFixture(uploads) {
  const { stdout, stderr, exitCode } = await runNodeScript([
    "scripts/learning-ui-fixture.mjs",
    "create",
    String(uploads)
  ]);
  if (exitCode !== 0) throw new Error(stderr || stdout || "fixture_create_failed");
  return JSON.parse(stdout);
}

async function cleanupFixture(fixture) {
  const { stdout, stderr, exitCode } = await runNodeScript([
    "scripts/learning-ui-fixture.mjs",
    "cleanup",
    fixture.ids.userId,
    fixture.ids.institutionId
  ]);
  if (exitCode !== 0) throw new Error(stderr || stdout || "fixture_cleanup_failed");
}

function runNodeScript(args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ["--use-system-ca", ...args], {
      cwd: process.cwd(),
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (exitCode) => resolve({ stdout, stderr, exitCode }));
  });
}

async function buildFileFixtures(tempDir) {
  const text = sampleLearningText();
  const fixtures = [
    {
      label: "DOCX",
      filename: "learning-ui-e2e.docx",
      mimeType: DOCX_MIME,
      buffer: await createDocxBuffer(text)
    },
    {
      label: "PDF",
      filename: "learning-ui-e2e.pdf",
      mimeType: "application/pdf",
      buffer: createPdfBuffer(text)
    },
    {
      label: "PPTX",
      filename: "learning-ui-e2e.pptx",
      mimeType: PPTX_MIME,
      buffer: await createPptxBuffer(text)
    }
  ];

  const requestedLabels = cli.labels;
  const selectedFixtures = requestedLabels.length
    ? fixtures.filter((fixture) => requestedLabels.includes(fixture.label))
    : fixtures;

  if (!selectedFixtures.length) {
    throw new Error(`no_matching_fixtures_${requestedLabels.join("_")}`);
  }

  for (const fixture of selectedFixtures) {
    fixture.filePath = path.join(tempDir, fixture.filename);
    fs.writeFileSync(fixture.filePath, fixture.buffer);
  }

  return selectedFixtures;
}

async function login(session, fixture) {
  await navigate(session, `${cli.baseUrl}/auth/email-login?next=%2Fmateriale%2Finvata`);
  await waitFor(
    () => evaluate(session, "Boolean(document.querySelector('#login-email') && document.querySelector('#login-password'))"),
    { timeoutMs: 20000, label: "login_form" }
  );
  await fill(session, "#login-email", fixture.email);
  await fill(session, "#login-password", fixture.password);
  await click(session, ".email-auth-primary");
  await waitFor(
    () => evaluate(session, "location.pathname === '/materiale/invata' && document.body.textContent.includes('Proceseaza materia')"),
    { timeoutMs: 30000, label: "learning_upload_page" }
  );
}

async function uploadFileThroughUi(session, fixture) {
  console.error(`ui-file-e2e: opening upload form for ${fixture.label}`);
  await navigate(session, `${cli.baseUrl}/materiale/invata`);
  await waitFor(
    () => evaluate(session, "Boolean(document.querySelector('input[type=file]') && document.body.textContent.includes('Proceseaza materia'))"),
    { timeoutMs: 20000, label: `upload_form_${fixture.label}` }
  );

  await fill(session, "input[name='title']", `UI File E2E ${fixture.label}`);
  console.error(`ui-file-e2e: setting file input for ${fixture.label}`);
  const fileInputNodeId = await queryNodeId(session, "input[type=file]");
  await session.send("DOM.setFileInputFiles", {
    nodeId: fileInputNodeId,
    files: [fixture.filePath]
  });
  await evaluate(session, `
    (() => {
      const input = document.querySelector("input[type=file]");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      return {
        fileCount: input.files.length,
        filename: input.files[0]?.name || ""
      };
    })()
  `);
  await waitFor(
    () => evaluate(session, "document.querySelector('button[type=submit]') && !document.querySelector('button[type=submit]').disabled"),
    { timeoutMs: 15000, label: `submit_enabled_${fixture.label}` }
  );
  console.error(`ui-file-e2e: submitting ${fixture.label}`);
  await click(session, "button[type=submit]");

  const studyUrl = await waitFor(
    () => evaluate(session, `
      location.pathname.startsWith("/materiale/invata/") && location.pathname.split("/").length >= 4
        ? location.href
        : null
    `),
    { timeoutMs: 45000, label: `redirect_${fixture.label}` }
  );
  console.error(`ui-file-e2e: redirected ${fixture.label} to ${studyUrl}`);

  const readyState = await waitFor(
    () => evaluate(session, `
      (() => {
        const text = document.body.textContent;
        if (text.includes("Materia este gata")) {
          return {
            status: "ready",
            url: location.href,
            hasChapters: text.includes("Capitole"),
            hasFlashcards: text.includes("Flashcards"),
            hasQuestions: text.includes("Intrebari")
          };
        }
        if (text.includes("Oprit") || text.toLowerCase().includes("eroare")) {
          return { status: "failed", url: location.href, text: text.slice(0, 1200) };
        }
        return null;
      })()
    `),
    { timeoutMs: 240000, intervalMs: 3000, label: `ready_${fixture.label}` }
  );

  if (readyState.status !== "ready") {
    throw new Error(`${fixture.label}_not_ready_${JSON.stringify(readyState)}`);
  }

  return {
    label: fixture.label,
    url: studyUrl,
    ready: readyState
  };
}

async function main() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "learning-ui-files-"));
  const fixtures = await buildFileFixtures(tempDir);
  let browser = null;
  let userFixture = null;

  try {
    console.error(`ui-file-e2e: target ${cli.baseUrl}`);
    console.error(`ui-file-e2e: creating fixture user for ${fixtures.map((item) => item.label).join(", ")}`);
    userFixture = await createFixture(fixtures.length);
    browser = await launchBrowser();
    console.error("ui-file-e2e: logging in");
    await login(browser.session, userFixture);

    const results = [];
    for (const fixture of fixtures) {
      console.error(`ui-file-e2e: starting ${fixture.label}`);
      results.push(await uploadFileThroughUi(browser.session, fixture));
      console.error(`ui-file-e2e: finished ${fixture.label}`);
    }

    console.log("learning:ui:file:e2e ok");
    console.log(JSON.stringify({ results }, null, 2));
  } finally {
    if (browser?.session) browser.session.close();
    if (browser?.edge) browser.edge.kill();
    if (browser?.userDataDir) fs.rmSync(browser.userDataDir, { recursive: true, force: true });
    fs.rmSync(tempDir, { recursive: true, force: true });
    if (userFixture) await cleanupFixture(userFixture);
  }
}

main().catch((error) => {
  process.exitCode = 1;
  console.error(error?.stack || error?.message || error);
});
