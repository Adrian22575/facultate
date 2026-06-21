import Link from "next/link";

import { AppHeader } from "@/components/app-header";
import { requireAdmin } from "@/lib/admin";
import {
  getSourceBucketStatus,
  SOURCE_BUCKET,
  SOURCE_BUCKET_BACKFILL_MIGRATION
} from "@/lib/ai/storage";
import { hasSiteUrlEnv, hasSupabasePublicEnv } from "@/lib/env/public";
import {
  getTelegramNotificationEnvStatus,
  hasOpenAIEnv,
  hasStripeSecretEnv,
  hasStripeWebhookEnv,
  hasSupabaseServiceEnv,
  hasTelegramNotificationEnv
} from "@/lib/env/server";
import { getAdminNotificationEventsSnapshot } from "@/lib/notifications/telegram";
import { getOpenAIRequestDiagnosticsSnapshot } from "@/lib/openai/logging";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Setup | Nota 5+"
};

function StepCard({ title, children, ready }) {
  return (
    <article className="draft-card">
      <div className="draft-card-head">
        <strong>{title}</strong>
        <span className={`status-pill ${ready ? "is-good" : "is-muted"}`}>
          {ready ? "gata" : "lipseste setup"}
        </span>
      </div>
      <div className="status-copy">{children}</div>
    </article>
  );
}

function DiagnosticStatusRow({ label, ready, readyLabel = "prezent", missingLabel = "lipseste" }) {
  return (
    <div className="status-row">
      <strong>{label}</strong>
      <span className={`status-pill ${ready ? "is-good" : "is-warning"}`}>
        {ready ? readyLabel : missingLabel}
      </span>
    </div>
  );
}

function formatSetupTimestamp(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString("ro-RO", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

function formatNotificationEventType(value) {
  const rawValue = String(value || "-");
  return rawValue
    .replace(/^ai\./i, "procesare.")
    .replace(/openai/gi, "provider")
    .replace(/\bai\b/gi, "procesare");
}

function formatTechnicalMessage(value) {
  if (!value) {
    return "-";
  }

  return String(value)
    .replace(/openai_request_logs/gi, "tabelul de logging tehnic")
    .replace(/OPENAI_API_KEY/g, "cheia privata de procesare")
    .replace(/OpenAI/gi, "providerul de procesare")
    .replace(/\bAI\b/g, "procesare");
}

export default async function SetupPage() {
  await requireAdmin("/setup");

  const siteUrlReady = hasSiteUrlEnv();
  const supabasePublicReady = hasSupabasePublicEnv();
  const supabaseServerReady = hasSupabaseServiceEnv();
  const stripeSecretReady = hasStripeSecretEnv();
  const stripeWebhookReady = hasStripeWebhookEnv();
  const stripeSandboxSecretReady = hasStripeSecretEnv("sandbox");
  const stripeSandboxWebhookReady = hasStripeWebhookEnv("sandbox");
  const openaiReady = hasOpenAIEnv();
  const telegramReady = hasTelegramNotificationEnv();
  const telegramEnvStatus = getTelegramNotificationEnvStatus();
  const [sourceBucketStatus, notificationEvents, openAIDiagnostics] = await Promise.all([
    getSourceBucketStatus(),
    getAdminNotificationEventsSnapshot(8),
    getOpenAIRequestDiagnosticsSnapshot(5)
  ]);

  const overallReady =
    siteUrlReady &&
    supabasePublicReady &&
    supabaseServerReady &&
    stripeSecretReady &&
    stripeWebhookReady &&
    openaiReady &&
    sourceBucketStatus.ready;

  return (
    <main className="app-shell">
      <AppHeader
        action={
          <Link className="btn-back" href="/">
            Inapoi la meniu
          </Link>
        }
        title="Setup si lansare"
        subtitle="Checklist-ul practic pentru configurarea locala, preview si productie."
      />

      <section className="surface">
        <div className="status-stack">
          <div className="status-row">
            <strong>Stare generala env</strong>
            <span className={`status-pill ${overallReady ? "is-good" : "is-warning"}`}>
              {overallReady ? "baza este completa" : "mai lipsesc configurari"}
            </span>
          </div>
        </div>

        <div className="inline-actions">
          <Link className="btn-back" href="/cont">
            Vezi contul
          </Link>
          <Link className="btn-link secondary" href="/preturi">
            Verifica billing
          </Link>
          <Link className="btn-link secondary" href="/materiale">
            Verifica Workspace
          </Link>
        </div>
      </section>

      <section className="surface">
        <div className="dashboard-header">
          <h2>Checklist rapid</h2>
          <p className="page-copy">
            Ghidurile complete sunt in <code>docs/deployment-readiness.md</code> si{" "}
            <code>docs/local-end-to-end-setup.md</code>.
          </p>
        </div>

        <div className="draft-list">
          <StepCard title="Site URL public" ready={siteUrlReady}>
            <p>
              Necesare: <code>NEXT_PUBLIC_SITE_URL</code> cu URL-ul public real al
              mediului curent.
            </p>
            <p>
              Local foloseste <code>http://localhost:3000</code>, iar in Vercel trebuie
              sa existe valori separate pentru Development, Preview si Production.
            </p>
          </StepCard>

          <StepCard title="Supabase public env" ready={supabasePublicReady}>
            <p>
              Necesare: <code>NEXT_PUBLIC_SUPABASE_URL</code> si{" "}
              <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>.
            </p>
            <p>
              Pentru rollout sigur pe Vercel, preview si productie ar trebui sa pointeze
              spre proiecte Supabase separate.
            </p>
          </StepCard>

          <StepCard title="Supabase service role" ready={supabaseServerReady}>
            <p>
              Necesare: <code>SUPABASE_SERVICE_ROLE_KEY</code> doar pe server.
            </p>
          </StepCard>

          <StepCard title="Stripe secret key" ready={stripeSecretReady}>
            <p>
              Necesare: <code>STRIPE_SECRET_KEY</code> pentru Checkout.
            </p>
          </StepCard>

          <StepCard title="Stripe webhook secret" ready={stripeWebhookReady}>
            <p>
              Necesare: <code>STRIPE_WEBHOOK_SECRET</code> pentru verificarea semnaturii
              webhook.
            </p>
          </StepCard>

          <StepCard title="Stripe sandbox admin" ready={stripeSandboxSecretReady}>
            <p>
              Optional pentru contul admin: <code>STRIPE_SANDBOX_SECRET_KEY</code> muta
              checkout-ul admin pe mediul sandbox.
            </p>
            <div className="status-stack">
              <DiagnosticStatusRow
                label="Sandbox secret key"
                ready={stripeSandboxSecretReady}
              />
              <DiagnosticStatusRow
                label="Sandbox webhook secret"
                ready={stripeSandboxWebhookReady}
              />
            </div>
          </StepCard>

          <StepCard title="Cheie procesare server" ready={openaiReady}>
            <p>
              Necesara: cheia privata pentru procesare, configurata doar pe server.
            </p>
          </StepCard>

          <StepCard title="Telegram admin notifications" ready={telegramReady}>
            <p>
              Optional: <code>TELEGRAM_BOT_TOKEN</code> si{" "}
              <code>TELEGRAM_ADMIN_CHAT_ID</code> pentru notificari admin.
            </p>
            <div className="status-stack">
              <DiagnosticStatusRow
                label="Bot token"
                ready={telegramEnvStatus.botTokenPresent}
              />
              <DiagnosticStatusRow
                label="Chat ID admin"
                ready={telegramEnvStatus.chatIdPresent}
              />
              <DiagnosticStatusRow
                label="Notificari active"
                ready={!telegramEnvStatus.notificationsDisabled}
                readyLabel="active"
                missingLabel="dezactivate"
              />
              <DiagnosticStatusRow
                label="Supabase service role"
                ready={telegramEnvStatus.supabaseServiceReady}
              />
            </div>
            <p>
              Daca tokenul a fost distribuit in chat, regenereaza-l in BotFather
              inainte sa il pui in env.
            </p>
          </StepCard>

          <StepCard title="Storage fisiere" ready={sourceBucketStatus.ready}>
            <p>
              Pentru uploadurile din Workspace trebuie sa existe bucketul privat{" "}
              <code>{SOURCE_BUCKET}</code> in Supabase Storage.
            </p>
            {sourceBucketStatus.ready ? (
              <p>Bucketul exista si este pregatit pentru fisierele urcate din Workspace.</p>
            ) : (
              <p>
                {sourceBucketStatus.message} Solutia standard este sa rulezi migrarea{" "}
                <code>{SOURCE_BUCKET_BACKFILL_MIGRATION}</code>.
              </p>
            )}
          </StepCard>
        </div>
      </section>

      <section className="surface">
        <div className="dashboard-header">
          <h2>Notificari admin</h2>
          <p className="page-copy">
            Ultimele evenimente deduplicate in <code>admin_notification_events</code>.
            Nu sunt afisate tokenuri, chat ID-uri sau alte secrete.
          </p>
        </div>

        {notificationEvents.warning ? (
          <div className="error-state" role="alert">{formatTechnicalMessage(notificationEvents.warning)}</div>
        ) : null}

        {notificationEvents.rows.length ? (
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Tip</th>
                  <th>Status</th>
                  <th>Eroare</th>
                  <th>Creat la</th>
                  <th>Trimis la</th>
                </tr>
              </thead>
              <tbody>
                {notificationEvents.rows.map((event) => (
                  <tr key={`${event.event_type}:${event.created_at}`}>
                    <td className="admin-table-code-cell">{formatNotificationEventType(event.event_type)}</td>
                    <td>
                      <span
                        className={`admin-table-pill ${
                          event.status === "sent"
                            ? "is-good"
                            : event.status === "failed"
                              ? "is-bad"
                              : "is-warning"
                        }`}
                      >
                        {event.status}
                      </span>
                    </td>
                    <td className="admin-table-wide-cell">{formatTechnicalMessage(event.last_error)}</td>
                    <td className="admin-table-date-cell">{formatSetupTimestamp(event.created_at)}</td>
                    <td className="admin-table-date-cell">{formatSetupTimestamp(event.sent_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : !notificationEvents.warning ? (
          <div className="empty-state">
            Nu exista inca notificari admin. Trimite feedback sau testeaza o plata dupa configurarea Telegram.
          </div>
        ) : null}
      </section>

      <section className="surface">
        <div className="dashboard-header">
          <h2>Diagnostic procesare</h2>
          <p className="page-copy">
            Ultimele erori tehnice de procesare, fara prompturi sau secrete.
          </p>
        </div>

        {openAIDiagnostics.warning ? (
          <div className="error-state" role="alert">{formatTechnicalMessage(openAIDiagnostics.warning)}</div>
        ) : null}

        {openAIDiagnostics.rows.length ? (
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Operatie</th>
                  <th>Scope</th>
                  <th>Model</th>
                  <th>Cod</th>
                  <th>Eroare</th>
                  <th>Creat la</th>
                </tr>
              </thead>
              <tbody>
                {openAIDiagnostics.rows.map((event) => (
                  <tr key={`${event.operation}:${event.request_scope}:${event.created_at}`}>
                    <td className="admin-table-code-cell">{event.operation || "-"}</td>
                    <td className="admin-table-code-cell">{event.request_scope || "-"}</td>
                    <td>{event.model || "-"}</td>
                    <td>
                      <span className="admin-table-pill is-warning">
                        {event.failure_code || "unknown"}
                      </span>
                    </td>
                    <td className="admin-table-wide-cell">{formatTechnicalMessage(event.error_message)}</td>
                    <td className="admin-table-date-cell">{formatSetupTimestamp(event.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : !openAIDiagnostics.warning ? (
          <div className="empty-state">Nu exista erori recente de procesare.</div>
        ) : null}
      </section>

      <section className="surface">
        <h2>Ordine recomandata</h2>
        <div className="check-list">
          <li>Configureaza Supabase Preview si Production separat si ruleaza migratiile `0001`-`0032` in ambele.</li>
          <li>Activeaza Google OAuth si adauga redirect URL-urile pentru local, preview si productie.</li>
          <li>Configureaza Stripe separat pentru Preview/Test si Production/Live, inclusiv webhook-ul catre `/api/stripe/webhook`.</li>
          <li>Adauga toate env-urile in Vercel pentru Development, Preview si Production, inclusiv `NEXT_PUBLIC_SITE_URL`.</li>
          <li>Verifica in `/setup` ca bucketul `private-source-documents` exista si ca toate check-urile de env sunt verzi.</li>
          <li>Testeaza local login, checkout, webhook, testele generate si testele private.</li>
          <li>Lanseaza intai pe Preview, valideaza fluxurile sensibile, apoi promoveaza in Production.</li>
        </div>
      </section>

      <section className="surface">
        <h2>Ce ramane manual</h2>
        <div className="check-list">
          <li>In Supabase SQL Editor rulezi, in ordine, `0001` pana la `0032`, separat pentru Preview si Production.</li>
          <li>Daca proiectul exista deja si lipseste storage-ul pentru fisiere, rulezi direct `0014_source_documents_storage_backfill.sql`.</li>
          <li>In Supabase Auth setezi `Site URL` si `Redirect URLs` pentru local, preview si productie, fiecare cu `/auth/callback`.</li>
          <li>In Google Cloud creezi un OAuth Client de tip Web application si autorizezi localhost, domeniul de productie si URL-ul de preview folosit pentru QA.</li>
          <li>In Stripe Sandbox pornesti local `stripe listen --events checkout.session.completed --forward-to http://localhost:3000/api/stripe/webhook` si copiezi secretul `whsec_...` in `.env.local`.</li>
          <li>In Stripe Preview/Test si Production/Live folosesti webhook secrets diferite si le pui in env-urile Vercel corespunzatoare.</li>
          <li>Dupa `0005`, utilizatorii isi aleg comunitatea din onboarding: institutie si specializare/profil.</li>
          <li>`0006` adauga o lista initiala de universitati si licee, iar utilizatorii pot completa restul direct din onboarding.</li>
          <li>`0008` muta catalogul de materii in Supabase, `0009` activeaza progresul real, iar `0010` activeaza feedback-ul trimis din aplicatie.</li>
          <li>`0017` activeaza logging-ul tehnic recomandat pentru audit si investigatii dupa lansare.</li>
          <li>`0026` activeaza deduplicarea notificarilor admin trimise catre Telegram.</li>
          <li>`0027` adauga timerul si heartbeat-ul pentru procesarea materialelor.</li>
          <li>Workspace nu poate salva fisiere daca bucketul `private-source-documents` lipseste din Supabase Storage.</li>
          <li>Pastrezi cheile secrete doar in `.env.local` sau in env-urile server-side din platforma de deploy si le rotesti daca au fost distribuite in chat.</li>
          <li>Dupa orice schimbare de env in Vercel, redeployezi mediul afectat inainte de retestare.</li>
        </div>
      </section>
    </main>
  );
}
