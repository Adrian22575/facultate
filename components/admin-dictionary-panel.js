"use client";

import {
  AlertTriangle,
  BadgeCheck,
  BookOpenCheck,
  CheckCircle2,
  Clock3,
  Eye,
  LoaderCircle,
  RefreshCw,
  Save,
  Search,
  Send,
  Undo2
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { AdminEditorialAutomationSettings } from "@/components/admin-editorial-automation-settings";

const ACTIVE_RUN_STATUSES = new Set(["started", "generated", "validated"]);
const RUN_PROGRESS = { started: 12, generated: 62, validated: 88 };
const splitLines = (value) => String(value || "").split("\n").map((item) => item.trim()).filter(Boolean);
const normalizeSearch = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("ro-RO").replace(/[^a-z0-9]+/g, " ").trim();

function formatDateTime(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ro-RO", { timeZone: "Europe/Bucharest", dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function todayInBucharest(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Bucharest", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function hourInBucharest(date = new Date()) {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Bucharest", hour: "2-digit", hourCycle: "h23" }).format(date));
}

function automationState(settings, runs, activeRun) {
  const hour = Number(settings?.scheduled_hour ?? 10);
  if (!settings?.enabled) return { tone: "muted", title: "Automatizarea este oprită", detail: "Activeaz-o și salvează setările pentru a relua generarea programată." };
  if (activeRun?.trigger_source === "cron") return { tone: "running", title: "Rularea programată este în curs", detail: `Pornită la ${formatDateTime(activeRun.started_at)}.` };
  const scheduledRun = runs.find((run) => run.trigger_source === "cron");
  if (scheduledRun?.run_date === todayInBucharest()) {
    if (scheduledRun.status === "published") return { tone: "success", title: "Termenul de astăzi a fost publicat", detail: `${formatDateTime(scheduledRun.finished_at)} · Telegram ${scheduledRun.notification_sent ? "trimis" : "omis din setări"}.` };
    if (scheduledRun.status === "notification_failed") return { tone: "warning", title: "Termen publicat, notificare netrimisă", detail: `${formatDateTime(scheduledRun.finished_at)} · Verifică detaliul în istoricul generărilor.` };
    if (scheduledRun.status === "failed") return { tone: "error", title: "Rularea de astăzi a eșuat", detail: scheduledRun.error_message || scheduledRun.rejection_reason || "Detaliul tehnic este păstrat în istoric." };
    return { tone: "running", title: "Rularea programată este în curs", detail: `Pornită la ${formatDateTime(scheduledRun.started_at)}.` };
  }
  if (hourInBucharest() >= hour) return { tone: "error", title: "Nicio rulare înregistrată astăzi", detail: `Ora programată, ${String(hour).padStart(2, "0")}:00, a trecut. Sistemul va marca aici imediat următoarea încercare.` };
  return { tone: "scheduled", title: `Programat astăzi la ${String(hour).padStart(2, "0")}:00`, detail: "Ora este afișată pentru România. Rezultatul și notificarea vor apărea aici." };
}

function formFromTerm(term) {
  return {
    categoryId: term.category_id,
    term: term.term,
    shortDefinition: term.short_definition,
    simpleExplanation: term.simple_explanation,
    analogy: term.analogy || "",
    example: term.example,
    whyItMatters: term.why_it_matters,
    howToApply: (term.how_to_apply || []).join("\n"),
    faqs: JSON.stringify(term.faqs || [], null, 2),
    ctaType: term.cta_type,
    synonyms: (term.synonyms || []).join(", ")
  };
}

function termStatus(status) {
  return {
    draft: { label: "Ciornă", help: "Vizibil numai în Admin.", tone: "draft" },
    published: { label: "Publicat", help: "Vizibil în Dicționar.", tone: "published" },
    withdrawn: { label: "Retras", help: "Ascuns public, păstrat în Admin.", tone: "withdrawn" },
    rejected: { label: "Respins", help: "Necesită corecturi înainte de publicare.", tone: "rejected" }
  }[status] || { label: status || "Necunoscut", help: "", tone: "draft" };
}

function runStatusLabel(status) {
  return {
    started: "Pregătim termenul nou",
    generated: "Verificăm unicitatea și conținutul",
    validated: "Salvăm termenul și legăturile",
    published: "Termen publicat",
    notification_failed: "Termen publicat, notificare netrimisă",
    failed: "Generarea s-a oprit",
    skipped: "Generare omisă"
  }[status] || status;
}

function ActionMessage({ message }) {
  if (!message) return null;
  return <p className={`admin-dictionary-action-message is-${message.tone || "info"}`} role="status" aria-live="polite" aria-atomic="true">{message.text}</p>;
}

export function AdminDictionaryPanel({ categories = [], terms = [], runs = [], automationSettings, generationPreview, warning }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(terms[0]?.id || "");
  const [termQuery, setTermQuery] = useState("");
  const [searchedTerms, setSearchedTerms] = useState([]);
  const [loadedTerms, setLoadedTerms] = useState([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const allTerms = useMemo(() => {
    const known = new Set(terms.map((term) => term.id));
    return [...terms, ...loadedTerms.filter((term) => !known.has(term.id))];
  }, [loadedTerms, terms]);
  const selected = useMemo(() => allTerms.find((term) => term.id === selectedId) || null, [allTerms, selectedId]);
  const [termPatches, setTermPatches] = useState({});
  const effectiveSelected = selected ? { ...selected, ...(termPatches[selected.id] || {}) } : null;
  const [form, setForm] = useState(() => selected ? formFromTerm(selected) : null);
  const [formTermId, setFormTermId] = useState(selected?.id || "");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState("");
  const [termMessage, setTermMessage] = useState(null);
  const [generationMessage, setGenerationMessage] = useState(null);
  const [confirmation, setConfirmation] = useState("");
  const activeRun = useMemo(() => runs.find((run) => ACTIVE_RUN_STATUSES.has(run.status)) || null, [runs]);
  const liveRun = activeRun || (busy === "generate" ? { status: "started" } : null);
  const latestRun = runs[0] || null;
  const persistedGenerationMessage = generationMessage || (!liveRun && latestRun?.status === "failed"
    ? { tone: "error", text: latestRun.error_message || latestRun.rejection_reason || "Ultima generare nu a produs un termen. Detaliile sunt în istoric." }
    : null);
  const visibleTerms = useMemo(() => {
    const query = normalizeSearch(termQuery);
    if (!query) return terms;
    if (query.length >= 2) return searchedTerms;
    return terms.filter((term) => normalizeSearch([term.term, term.slug, ...(term.synonyms || [])].join(" ")).includes(query));
  }, [searchedTerms, termQuery, terms]);
  const scheduleState = automationState(automationSettings, runs, activeRun);

  useEffect(() => {
    const query = termQuery.trim();
    if (query.length < 2) {
      setSearchedTerms([]);
      setSearchBusy(false);
      setSearchError(false);
      return undefined;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearchBusy(true);
      setSearchError(false);
      const response = await fetch(`/api/admin/dictionary/terms/search?q=${encodeURIComponent(query)}`, { signal: controller.signal }).catch(() => null);
      const result = await response?.json().catch(() => ({}));
      if (!controller.signal.aborted && response?.ok) {
        const next = result.terms || [];
        setSearchedTerms(next);
        setLoadedTerms((current) => {
          const known = new Set(current.map((term) => term.id));
          return [...current, ...next.filter((term) => !known.has(term.id))];
        });
      } else if (!controller.signal.aborted) {
        setSearchedTerms([]);
        setSearchError(true);
      }
      if (!controller.signal.aborted) setSearchBusy(false);
    }, 250);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [termQuery]);

  useEffect(() => {
    if (!selected) return;
    if (formTermId !== selected.id) {
      setForm(formFromTerm(selected));
      setFormTermId(selected.id);
      setDirty(false);
    }
  }, [formTermId, selected]);

  useEffect(() => {
    if (!liveRun) return undefined;
    const timer = window.setInterval(() => router.refresh(), 4500);
    return () => window.clearInterval(timer);
  }, [liveRun?.id, liveRun?.status, router]);

  function patchTerm(termId, patch) {
    setTermPatches((current) => ({ ...current, [termId]: { ...(current[termId] || {}), ...patch } }));
  }

  function select(term) {
    if (dirty && !window.confirm("Ai modificări nesalvate. Vrei să alegi alt termen și să renunți la ele?")) return;
    setSelectedId(term.id);
    setForm(formFromTerm(term));
    setFormTermId(term.id);
    setDirty(false);
    setTermMessage(null);
    setConfirmation("");
  }

  function setField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
    setDirty(true);
    setTermMessage(null);
    setConfirmation("");
  }

  async function save() {
    if (!effectiveSelected || !form || busy) return;
    let faqs;
    try {
      faqs = JSON.parse(form.faqs);
    } catch {
      setTermMessage({ tone: "error", text: "Întrebările frecvente trebuie să aibă format JSON valid." });
      return;
    }

    setBusy("save");
    setTermMessage(null);
    const response = await fetch(`/api/admin/dictionary/terms/${effectiveSelected.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...form,
        analogy: form.analogy || null,
        howToApply: splitLines(form.howToApply),
        faqs,
        synonyms: form.synonyms.split(",").map((item) => item.trim()).filter(Boolean)
      })
    }).catch(() => null);
    const result = await response?.json().catch(() => ({}));
    setBusy("");

    if (!response) {
      setTermMessage({ tone: "error", text: "Nu am putut contacta serviciul. Încearcă din nou." });
      return;
    }
    if (!response.ok) {
      const reasons = Array.isArray(result?.reasons) ? result.reasons.join(" ") : "";
      setTermMessage({
        tone: "error",
        text: result?.error === "quality_check_failed"
          ? `Conținutul nu a trecut verificarea de calitate.${reasons ? ` ${reasons}` : ""}`
          : result?.error === "invalid_payload"
            ? "Unele câmpuri sunt incomplete sau prea scurte. Verifică textele și cele trei întrebări frecvente."
            : "Nu am putut salva modificările."
      });
      return;
    }

    patchTerm(effectiveSelected.id, result.term);
    setDirty(false);
    setTermMessage({
      tone: "success",
      text: effectiveSelected.status === "published"
        ? "Modificările au fost salvate și au trecut verificarea. Termenul a fost retras temporar până la republicare."
        : `Modificările au fost salvate. Scor editorial: ${result.term.quality_score}/100.`
    });
    router.refresh();
  }

  async function generate() {
    if (activeRun || busy || dirty) return;
    setBusy("generate");
    setGenerationMessage(null);
    const response = await fetch("/api/admin/dictionary/generate", { method: "POST" }).catch(() => null);
    const result = await response?.json().catch(() => ({}));
    setBusy("");

    if (!response) {
      setGenerationMessage({ tone: "error", text: "Nu am putut contacta serviciul de generare. Încearcă din nou." });
      return;
    }
    if (response.ok && result?.term?.id) {
      setSelectedId(result.term.id);
      setFormTermId("");
      setForm(null);
      setGenerationMessage({ tone: "success", text: `Termenul „${result.term.term}” a fost publicat și deschis pentru revizuire.` });
    } else {
      setGenerationMessage({ tone: "error", text: "Generarea nu a produs un termen. Motivul este afișat în istoric." });
    }
    router.refresh();
  }

  async function runAction(action) {
    if (!effectiveSelected || dirty || busy) return;
    setBusy(action);
    setTermMessage(null);
    const response = await fetch(`/api/admin/dictionary/terms/${effectiveSelected.id}/actions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action })
    }).catch(() => null);
    const result = await response?.json().catch(() => ({}));
    setBusy("");
    setConfirmation("");

    if (!response) {
      setTermMessage({ tone: "error", text: "Nu am putut contacta serviciul. Încearcă din nou." });
      return;
    }
    if (!response.ok) {
      setTermMessage({
        tone: "error",
        text: result?.error === "publication_quality_not_met"
          ? "Publicarea este blocată până când termenul obține un scor editorial de cel puțin 82."
          : "Acțiunea nu a fost salvată. Încearcă din nou."
      });
      return;
    }

    const nextStatus = action === "publish" ? "published" : "withdrawn";
    patchTerm(effectiveSelected.id, { status: nextStatus });
    setTermMessage({
      tone: "success",
      text: action === "publish"
        ? "Termenul este publicat și poate fi deschis în Dicționar."
        : "Termenul a fost retras din Dicționar. Rămâne disponibil în Admin."
    });
    router.refresh();
  }

  const statusInfo = termStatus(effectiveSelected?.status);
  const score = Number(effectiveSelected?.quality_score || 0);
  const isPublished = effectiveSelected?.status === "published";
  const canPublish = !dirty && score >= 82 && !isPublished;
  const selectedCategory = categories.find((category) => category.id === form?.categoryId)?.name || effectiveSelected?.category?.name || "—";

  return (
    <section className="surface admin-dictionary-panel">
      <div className="admin-content-toolbar">
        <AdminEditorialAutomationSettings workflow="dictionary" settings={automationSettings} generationPreview={generationPreview} />
        <button type="button" className="btn-link" onClick={generate} disabled={Boolean(busy) || Boolean(activeRun) || dirty} title={dirty ? "Salvează modificările înainte de a genera alt termen." : undefined}>
          {liveRun ? <LoaderCircle size={16} className="is-spinning" /> : <RefreshCw size={16} />}
          {liveRun ? "Generare în curs" : "Generează un termen"}
        </button>
      </div>

      {liveRun ? (
        <section className="admin-dictionary-live-run" aria-live="polite">
          <LoaderCircle className="is-spinning" aria-hidden="true" size={23} />
          <div>
            <span>Generare în curs</span>
            <strong>{runStatusLabel(liveRun.status)}</strong>
            <p>Poți părăsi pagina. Starea rămâne salvată și se actualizează automat când revii.</p>
          </div>
          <div className="admin-dictionary-live-progress" aria-label={`Progres estimat ${RUN_PROGRESS[liveRun.status] || 12}%`}>
            <span>{RUN_PROGRESS[liveRun.status] || 12}%</span>
            <i style={{ width: `${RUN_PROGRESS[liveRun.status] || 12}%` }} />
          </div>
        </section>
      ) : null}
      {persistedGenerationMessage ? <ActionMessage message={persistedGenerationMessage} /> : null}
      {warning ? <p className="admin-dictionary-message is-error">{warning}</p> : null}
      <section className={`admin-dictionary-schedule-status is-${scheduleState.tone}`} aria-live="polite">
        <Clock3 size={19} aria-hidden="true" />
        <div><span>Automatizare dicționar</span><strong>{scheduleState.title}</strong><small>{scheduleState.detail}</small></div>
      </section>

      <div className="admin-dictionary-grid">
        <div className="admin-dictionary-list">
          <div className="admin-dictionary-list-tools">
            <label className="admin-dictionary-search" aria-label="Caută termeni">
              {searchBusy ? <LoaderCircle className="is-spinning" size={16} aria-hidden="true" /> : <Search size={16} aria-hidden="true" />}
              <input type="search" value={termQuery} onChange={(event) => setTermQuery(event.target.value)} placeholder="Caută după termen" autoComplete="off" />
            </label>
            <p className="admin-dictionary-list-count" aria-live="polite">{termQuery.trim().length >= 2 ? searchBusy ? "Căutăm în dicționar…" : searchError ? "Căutarea nu este disponibilă" : `${visibleTerms.length} rezultate` : `${terms.length} termeni recenți`}</p>
          </div>
          {visibleTerms.map((term) => {
            const displayed = { ...term, ...(termPatches[term.id] || {}) };
            const displayedStatus = termStatus(displayed.status);
            return (
              <button type="button" key={term.id} className={`admin-dictionary-list-item${term.id === selectedId ? " is-selected" : ""}`} onClick={() => select(displayed)} disabled={Boolean(busy)}>
                <BookOpenCheck size={16} />
                <span className="admin-dictionary-list-copy">
                  <strong>{displayed.term}</strong>
                  <small className="admin-dictionary-list-meta"><b>{displayedStatus.label}</b><i aria-hidden="true">·</i> Calitate {displayed.quality_score ?? "—"}/100</small>
                  <time className="admin-dictionary-list-created" dateTime={displayed.created_at || undefined} title={`Creat la ${formatDateTime(displayed.created_at)}`}>
                    <Clock3 size={13} aria-hidden="true" /> Creat: {formatDateTime(displayed.created_at)}
                  </time>
                </span>
              </button>
            );
          })}
          {!searchBusy && !searchError && visibleTerms.length === 0 ? <div className="admin-dictionary-list-empty"><strong>Niciun termen găsit</strong><span>Încearcă o formulare mai scurtă sau fără semne speciale.</span></div> : null}
          {searchError ? <div className="admin-dictionary-list-empty is-error"><strong>Căutarea nu a răspuns</strong><span>Termenii recenți rămân disponibili. Încearcă din nou.</span></div> : null}
        </div>

        {effectiveSelected && form ? (
          <div className="admin-dictionary-editor" aria-busy={Boolean(busy)} inert={busy ? true : undefined}>
            <div className="admin-dictionary-statebar">
              <div className={`is-${statusInfo.tone}`}><span>Stare</span><strong>{statusInfo.label}</strong><small>{statusInfo.help}</small></div>
              <div className={score >= 82 ? "is-passed" : "is-failed"}><span>Calitate</span><strong>{dirty ? "Modificări nesalvate" : `${score}/100`}</strong><small>{dirty ? "Salvează pentru recalcularea scorului." : score >= 82 ? "Pragul editorial este îndeplinit." : "Pragul de publicare este 82."}</small></div>
              <div><span>Categorie</span><strong>{selectedCategory}</strong><small>Poate fi schimbată înainte de publicare.</small></div>
            </div>

            <div className="admin-dictionary-row is-primary">
              <label>Termen<input value={form.term} onChange={(event) => setField("term", event.target.value)} /></label>
              <label>Categorie<select value={form.categoryId} onChange={(event) => setField("categoryId", event.target.value)}>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
            </div>
            <label>Definiție scurtă<textarea value={form.shortDefinition} onChange={(event) => setField("shortDefinition", event.target.value)} /></label>
            <label>Explicație simplă<textarea value={form.simpleExplanation} onChange={(event) => setField("simpleExplanation", event.target.value)} /></label>

            <details className="admin-dictionary-content-details">
              <summary>Conținut extins, întrebări și acțiune</summary>
              <div>
                <label>Analogie <small>opțională, dar crește scorul editorial</small><textarea value={form.analogy} onChange={(event) => setField("analogy", event.target.value)} /></label>
                <label>Exemplu<textarea value={form.example} onChange={(event) => setField("example", event.target.value)} /></label>
                <label>De ce contează<textarea value={form.whyItMatters} onChange={(event) => setField("whyItMatters", event.target.value)} /></label>
                <label>Pași <small>un pas pe fiecare rând</small><textarea value={form.howToApply} onChange={(event) => setField("howToApply", event.target.value)} /></label>
                <label>Sinonime <small>separate prin virgulă</small><input value={form.synonyms} onChange={(event) => setField("synonyms", event.target.value)} /></label>
                <label>Întrebări frecvente <small>exact trei întrebări, în format JSON</small><textarea className="admin-dictionary-json" value={form.faqs} onChange={(event) => setField("faqs", event.target.value)} /></label>
                <label>Acțiune recomandată<select value={form.ctaType} onChange={(event) => setField("ctaType", event.target.value)}><option value="practice">Exersează prin grile</option><option value="materials">Încarcă materia</option><option value="review">Repetă ce ai greșit</option><option value="simulation">Începe o simulare</option></select></label>
              </div>
            </details>

            <section className="admin-dictionary-workflow" aria-labelledby="dictionary-workflow-title">
              <div className="admin-dictionary-workflow-head">
                <div><span>Flux editorial</span><h3 id="dictionary-workflow-title">Salvează, previzualizează și publică</h3></div>
                <button type="button" className="btn-back" onClick={save} disabled={!dirty || Boolean(busy)}><Save size={16} />{busy === "save" ? "Se salvează…" : dirty ? "Salvează modificările" : "Modificări salvate"}</button>
              </div>

              {isPublished && dirty ? <p className="admin-dictionary-edit-warning"><AlertTriangle size={16} />Salvarea va retrage temporar termenul până când confirmi republicarea.</p> : null}

              <div className="admin-dictionary-workflow-steps">
                <article className={score >= 82 && !dirty ? "is-passed" : ""}>
                  <BadgeCheck aria-hidden="true" size={20} />
                  <div><span>1. Calitate</span><strong>{dirty ? "Recalculare necesară" : score >= 82 ? "Verificare trecută" : "Necesită corecturi"}</strong><p>La salvare verificăm structura, cele trei întrebări, textele de lucru și claritatea conținutului. Nu publicăm automat modificările.</p></div>
                  <span className="admin-dictionary-score">{dirty ? "—" : score}/100</span>
                </article>

                <article>
                  <Eye aria-hidden="true" size={20} />
                  <div><span>2. Previzualizare</span><strong>Pagină privată</strong><p>Vezi termenul exact cum va arăta, inclusiv când este ciornă sau retras.</p></div>
                  {dirty ? <span className="admin-dictionary-disabled-action">Salvează mai întâi</span> : <a className="btn-back" href={`/admin/dictionar/${effectiveSelected.id}/preview`} target="_blank" rel="noreferrer">Deschide previzualizarea</a>}
                </article>

                <article className={isPublished ? "is-published" : ""}>
                  {isPublished ? <CheckCircle2 aria-hidden="true" size={20} /> : <Send aria-hidden="true" size={20} />}
                  <div><span>3. Publicare</span><strong>{isPublished ? "Termen publicat" : canPublish ? "Pregătit pentru publicare" : "Publicare indisponibilă"}</strong><p>{isPublished ? "Termenul este vizibil în Dicționar." : canPublish ? "Confirmarea îl face vizibil public imediat." : "Salvează și obține un scor de cel puțin 82."}</p></div>
                  <div className="admin-dictionary-step-actions">
                    {isPublished ? <a className="btn-back" href={`/dictionar/${effectiveSelected.slug}`} target="_blank" rel="noreferrer">Vezi termenul public</a> : <button type="button" className="btn-link" onClick={() => setConfirmation("publish")} disabled={!canPublish || Boolean(busy)}>Publică termenul</button>}
                    {isPublished ? <button type="button" className="admin-dictionary-withdraw" onClick={() => setConfirmation("withdraw")} disabled={Boolean(busy)}><Undo2 size={15} />Retrage din site</button> : null}
                  </div>
                </article>
              </div>

              {confirmation ? (
                <div className={`admin-dictionary-confirmation is-${confirmation}`}>
                  <div><strong>{confirmation === "publish" ? "Publici termenul acum?" : "Retragi termenul din Dicționar?"}</strong><p>{confirmation === "publish" ? "Termenul va deveni vizibil public imediat." : "Termenul va fi ascuns public, dar rămâne în Admin și poate fi republicat."}</p></div>
                  <div><button type="button" className={confirmation === "publish" ? "btn-link" : "admin-dictionary-withdraw is-confirm"} onClick={() => runAction(confirmation)} disabled={Boolean(busy)}>{busy === confirmation ? "Se salvează…" : confirmation === "publish" ? "Da, publică" : "Da, retrage"}</button><button type="button" className="btn-back" onClick={() => setConfirmation("")} disabled={Boolean(busy)}>Anulează</button></div>
                </div>
              ) : null}

              <ActionMessage message={termMessage} />
            </section>
          </div>
        ) : <div className="admin-dictionary-editor is-empty">Alege un termen pentru editare.</div>}
      </div>

      <details className="admin-run-history" open={runs.some((run) => run.status === "failed")}>
        <summary>Istoric generări ({runs.length})</summary>
        {runs.length ? <div className="admin-dictionary-runs">{runs.map((run) => <article key={run.id}><strong>{run.candidate_term || "Fără termen"}</strong><span>{run.trigger_source === "cron" ? "Programat" : "Manual"} · {runStatusLabel(run.status)} · {run.model || "model necunoscut"}</span><small>{run.quality_score == null ? "Scor indisponibil" : `${run.quality_score}/100`}</small>{run.rejection_reason || run.error_message ? <small>{run.rejection_reason || run.error_message}</small> : null}</article>)}</div> : <p>Nu există rulări încă.</p>}
      </details>
    </section>
  );
}
