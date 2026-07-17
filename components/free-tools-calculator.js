"use client";

import { Clipboard, RefreshCcw, Share2 } from "lucide-react";
import { useMemo, useState } from "react";

import {
  calculateDailyQuestions,
  calculateExamScore,
  calculateFinishDate,
  calculateRequiredSimulationScore,
  dateInputValue,
  formatDate,
  generateStudyPlan
} from "@/lib/free-tools";

const today = dateInputValue();
const nextMonth = (() => {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return dateInputValue(date);
})();

const defaults = {
  "cate-grile-pe-zi": { totalQuestions: 600, solvedQuestions: 80, examDate: nextMonth, daysRemaining: "", daysPerWeek: 5, repetitions: 2, errorRate: 20 },
  "in-cate-zile-termin-materia": { total: 180, completed: 30, dailyRate: 12, daysPerWeek: 5, reviewDays: 2, startDate: today, examDate: nextMonth },
  "plan-de-invatare": { materialType: "pagini", total: 180, completed: 20, examDate: nextMonth, daysPerWeek: 5, minutesPerDay: 45, difficulty: "mediu", wantsReview: true, wantsSimulations: true },
  "calculator-punctaj-examen": { totalQuestions: 100, correct: 65, wrong: 20, skipped: 15, basePoints: 10, maxGrade: 10, passGrade: 5, penalty: 0 },
  "scor-necesar-simulare": { scores: "62, 68, 71", targetAverage: 75, plannedTotal: 5, remaining: 2 }
};

function NumberField({ id, label, hint, value, onChange, min = 0, max, step = 1 }) {
  return (
    <label className="free-tool-field" htmlFor={id}>
      <span>{label}</span>
      <input id={id} type="number" min={min} max={max} step={step} value={value} onChange={(event) => onChange(event.target.value)} />
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

function DateField({ id, label, hint, value, onChange, min }) {
  return (
    <label className="free-tool-field" htmlFor={id}>
      <span>{label}</span>
      <input id={id} type="date" min={min} value={value} onChange={(event) => onChange(event.target.value)} />
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

function SelectField({ id, label, value, onChange, children }) {
  return (
    <label className="free-tool-field" htmlFor={id}>
      <span>{label}</span>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>{children}</select>
    </label>
  );
}

function ToggleField({ id, label, checked, onChange, hint }) {
  return (
    <label className="free-tool-toggle" htmlFor={id}>
      <input id={id} type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span><strong>{label}</strong>{hint ? <small>{hint}</small> : null}</span>
    </label>
  );
}

function formatNumber(value, digits = 0) {
  return new Intl.NumberFormat("ro-RO", { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value);
}

function resultText(slug, result) {
  if (slug === "cate-grile-pe-zi") return `${result.totalPerDay} grile pe zi de studiu: ${result.newPerDay} noi și ${result.reviewPerDay} de repetat. ${result.intensity.label}.`;
  if (slug === "in-cate-zile-termin-materia") return `Termini materia pe ${formatDate(result.completionDate)} după ${result.studyDays} zile de studiu.`;
  if (slug === "plan-de-invatare") return result.fits ? `Planul intră înainte de examen, cu ${result.dailyVolume} ${result.materialType} pe zi de studiu.` : `Planul are nevoie de ${result.requiredDailyVolume} ${result.materialType} pe zi de studiu ca să încapă înainte de examen.`;
  if (slug === "calculator-punctaj-examen") return `Punctaj: ${formatNumber(result.rawPoints, 2)} din ${formatNumber(result.maximumPoints, 2)}. Nota estimată: ${formatNumber(result.grade, 2)}.`;
  return result.possible ? `Ai nevoie de o medie de ${formatNumber(result.requiredAverage, 1)} la simulările rămase.` : "Ținta nu mai este posibilă matematic cu scoruri de maximum 100.";
}

function ScoreResult({ result }) {
  return (
    <div className="free-tool-result-grid">
      <div><span>Punctaj brut</span><strong>{formatNumber(result.rawPoints, 2)}</strong><small>din {formatNumber(result.maximumPoints, 2)}</small></div>
      <div><span>Procent</span><strong>{formatNumber(result.percentage, 1)}%</strong><small>din punctajul maxim</small></div>
      <div><span>Nota estimată</span><strong>{formatNumber(result.grade, 2)}</strong><small>{result.passed ? "prag atins" : "sub prag"}</small></div>
      <div><span>Următorul prag</span><strong>{result.questionsForNextThreshold}</strong><small>întrebări de corectat</small></div>
    </div>
  );
}

function PlanResult({ result }) {
  return (
    <>
      <div className={`free-tool-answer ${result.fits ? "is-positive" : "is-warning"}`}>
        <span>Răspuns direct</span>
        <strong>{result.fits ? `${result.dailyVolume} ${result.materialType} pe zi de studiu` : `${result.requiredDailyVolume} ${result.materialType} pe zi sunt necesare`}</strong>
        <p>{result.recommendation}</p>
      </div>
      <ol className="free-tool-plan-list" aria-label="Planul de învățare">
        {result.plan.map((item) => (
          <li key={`${item.date.toISOString()}-${item.type}`} className={`is-${item.type}`}>
            <time dateTime={dateInputValue(item.date)}>{formatDate(item.date)}</time>
            <span>{item.type === "study" ? "Studiu" : item.type === "review" ? "Recapitulare" : "Simulare"}</span>
            <strong>{item.label}</strong>
          </li>
        ))}
      </ol>
      {result.hiddenDays ? <p className="free-tool-muted">Planul continuă încă {result.hiddenDays} zile. Ziua tampon rămâne {formatDate(result.bufferDate)}.</p> : null}
    </>
  );
}

function ResultContent({ slug, result }) {
  if (slug === "cate-grile-pe-zi") {
    return <><div className={`free-tool-answer is-${result.intensity.tone}`}><span>Răspuns direct</span><strong>{result.totalPerDay} grile pe zi de studiu</strong><p>{result.newPerDay} grile noi + {result.reviewPerDay} grile de repetat, în aproximativ {result.minutesPerDay} minute.</p></div><div className="free-tool-result-grid"><div><span>Grile noi</span><strong>{result.newPerDay}</strong><small>într-o zi de studiu</small></div><div><span>Repetări</span><strong>{result.reviewPerDay}</strong><small>greșeli estimate</small></div><div><span>Ritm</span><strong>{result.intensity.label}</strong><small>{result.studyDays} zile disponibile</small></div></div></>;
  }
  if (slug === "in-cate-zile-termin-materia") {
    return <><div className={`free-tool-answer ${result.exceedsExam ? "is-warning" : "is-positive"}`}><span>Data estimată de finalizare</span><strong>{formatDate(result.completionDate)}</strong><p>{result.recommendation}</p></div><div className="free-tool-result-grid"><div><span>Zile de studiu</span><strong>{result.studyDays}</strong><small>zile efective</small></div><div><span>Zile calendaristice</span><strong>{result.calendarDays}</strong><small>până la final</small></div><div><span>Recapitulare</span><strong>{result.reviewStartDate ? formatDate(result.reviewStartDate) : "neplanificată"}</strong><small>data de început</small></div></div></>;
  }
  if (slug === "plan-de-invatare") return <PlanResult result={result} />;
  if (slug === "calculator-punctaj-examen") return <><div className={`free-tool-answer ${result.passed ? "is-positive" : "is-warning"}`}><span>Rezultat</span><strong>{result.passed ? "Pragul de promovare este atins" : "Pragul de promovare nu este încă atins"}</strong><p>Nota estimată este {formatNumber(result.grade, 2)} din {formatNumber(result.maximumPoints, 0)}.</p></div><ScoreResult result={result} /></>;
  return <><div className={`free-tool-answer ${result.possible ? "is-positive" : "is-warning"}`}><span>Răspuns direct</span><strong>{result.possible ? `${formatNumber(result.nextScore, 1)} la următoarea simulare` : "Ținta nu mai este posibilă"}</strong><p>{result.recommendation}</p></div><div className="free-tool-result-grid"><div><span>Media actuală</span><strong>{formatNumber(result.currentAverage, 1)}</strong><small>din simulările făcute</small></div><div><span>Media dorită</span><strong>{formatNumber(result.targetAverage, 1)}</strong><small>la final</small></div><div><span>Trend</span><strong>{result.trend.split(":")[0]}</strong><small>comparat cu primul scor</small></div></div></>;
}

function ToolFields({ slug, values, setValue }) {
  const set = (key) => (value) => setValue(key, value);
  if (slug === "cate-grile-pe-zi") return <div className="free-tool-fields"><NumberField id="total-questions" label="Câte grile ai în total?" value={values.totalQuestions} onChange={set("totalQuestions")} min={1} /><NumberField id="solved-questions" label="Câte grile ai rezolvat deja?" value={values.solvedQuestions} onChange={set("solvedQuestions")} min={0} /><DateField id="exam-date" label="Data examenului" hint="sau completează zilele rămase" value={values.examDate} onChange={set("examDate")} min={today} /><NumberField id="remaining-days" label="Zile rămase (opțional)" hint="folosit doar dacă lași data goală" value={values.daysRemaining} onChange={set("daysRemaining")} min={1} /><NumberField id="study-days" label="Zile de studiu pe săptămână" value={values.daysPerWeek} onChange={set("daysPerWeek")} min={1} max={7} /><NumberField id="repetitions" label="De câte ori repeți greșelile?" value={values.repetitions} onChange={set("repetitions")} min={0} max={10} /><NumberField id="error-rate" label="Procent estimat de greșeli" hint="poți lăsa valoarea implicită" value={values.errorRate} onChange={set("errorRate")} min={0} max={100} /></div>;
  if (slug === "in-cate-zile-termin-materia") return <div className="free-tool-fields"><NumberField id="material-total" label="Volumul total" hint="pagini, capitole sau grile" value={values.total} onChange={set("total")} min={1} /><NumberField id="material-completed" label="Cât ai parcurs deja?" value={values.completed} onChange={set("completed")} min={0} /><NumberField id="daily-rate" label="Cât parcurgi într-o zi?" value={values.dailyRate} onChange={set("dailyRate")} min={1} /><NumberField id="finish-study-days" label="Zile de studiu pe săptămână" value={values.daysPerWeek} onChange={set("daysPerWeek")} min={1} max={7} /><NumberField id="review-days" label="Zile pentru recapitulare" value={values.reviewDays} onChange={set("reviewDays")} min={0} /><DateField id="start-date" label="Începi din data" value={values.startDate} onChange={set("startDate")} /><DateField id="finish-exam-date" label="Data examenului (opțional)" value={values.examDate} onChange={set("examDate")} min={values.startDate || today} /></div>;
  if (slug === "plan-de-invatare") return <div className="free-tool-fields"><SelectField id="material-type" label="Tipul materialului" value={values.materialType} onChange={set("materialType")}><option value="pagini">Pagini</option><option value="capitole">Capitole</option><option value="grile">Grile</option></SelectField><NumberField id="plan-total" label="Volumul total" value={values.total} onChange={set("total")} min={1} /><NumberField id="plan-completed" label="Progres actual" value={values.completed} onChange={set("completed")} min={0} /><DateField id="plan-exam" label="Data examenului" value={values.examDate} onChange={set("examDate")} min={today} /><NumberField id="plan-days" label="Zile disponibile pe săptămână" value={values.daysPerWeek} onChange={set("daysPerWeek")} min={1} max={7} /><NumberField id="minutes" label="Minute disponibile pe zi" value={values.minutesPerDay} onChange={set("minutesPerDay")} min={10} step={5} /><SelectField id="difficulty" label="Dificultatea percepută" value={values.difficulty} onChange={set("difficulty")}><option value="ușor">Ușor</option><option value="mediu">Mediu</option><option value="dificil">Dificil</option></SelectField><div className="free-tool-toggles"><ToggleField id="review" label="Include recapitulare" checked={values.wantsReview} onChange={set("wantsReview")} hint="sesiuni scurte pentru consolidare" /><ToggleField id="simulations" label="Include simulări" checked={values.wantsSimulations} onChange={set("wantsSimulations")} hint="simulări și analiza greșelilor" /></div></div>;
  if (slug === "calculator-punctaj-examen") return <div className="free-tool-fields"><NumberField id="score-total" label="Numărul total de întrebări" value={values.totalQuestions} onChange={set("totalQuestions")} min={1} /><NumberField id="correct" label="Răspunsuri corecte" value={values.correct} onChange={set("correct")} min={0} /><NumberField id="wrong" label="Răspunsuri greșite" value={values.wrong} onChange={set("wrong")} min={0} /><NumberField id="skipped" label="Întrebări necompletate" value={values.skipped} onChange={set("skipped")} min={0} /><NumberField id="base-points" label="Puncte din oficiu" value={values.basePoints} onChange={set("basePoints")} min={0} step={0.1} /><NumberField id="max-grade" label="Nota maximă" value={values.maxGrade} onChange={set("maxGrade")} min={1} step={0.5} /><NumberField id="pass-grade" label="Pragul de promovare" value={values.passGrade} onChange={set("passGrade")} min={0} step={0.5} /><NumberField id="penalty" label="Penalizare pentru o greșeală" hint="0 dacă nu există" value={values.penalty} onChange={set("penalty")} min={0} step={0.05} /></div>;
  return <div className="free-tool-fields"><label className="free-tool-field free-tool-field-wide" htmlFor="scores"><span>Scorurile simulărilor anterioare</span><input id="scores" inputMode="decimal" value={values.scores} onChange={(event) => set("scores")(event.target.value)} /><small>Separă scorurile prin virgulă, de exemplu: 62, 68, 71.</small></label><NumberField id="target-average" label="Scorul mediu dorit" value={values.targetAverage} onChange={set("targetAverage")} min={0} max={100} step={0.5} /><NumberField id="planned-total" label="Simulări planificate în total" value={values.plannedTotal} onChange={set("plannedTotal")} min={1} /><NumberField id="remaining-simulations" label="Câte simulări mai sunt?" value={values.remaining} onChange={set("remaining")} min={1} /></div>;
}

export function FreeToolsCalculator({ tool }) {
  const initialValues = useMemo(() => ({ ...defaults[tool.slug] }), [tool.slug]);
  const [values, setValues] = useState(initialValues);
  const [result, setResult] = useState(null);
  const [message, setMessage] = useState("");

  const setValue = (key, value) => {
    setValues((current) => ({ ...current, [key]: value }));
    setResult(null);
    setMessage("Valorile au fost modificate. Recalculează pentru un rezultat actualizat.");
  };

  const calculate = () => {
    const input = tool.slug === "scor-necesar-simulare" ? { ...values, scores: String(values.scores).split(",").map((score) => score.trim()) } : values;
    const calculators = { "cate-grile-pe-zi": calculateDailyQuestions, "in-cate-zile-termin-materia": calculateFinishDate, "plan-de-invatare": generateStudyPlan, "calculator-punctaj-examen": calculateExamScore, "scor-necesar-simulare": calculateRequiredSimulationScore };
    const nextResult = calculators[tool.slug](input);
    setResult(nextResult);
    setMessage(nextResult.ok ? "Rezultatul a fost actualizat." : "Verifică datele din formular.");
  };

  const reset = () => { setValues({ ...initialValues }); setResult(null); setMessage("Formular resetat."); };
  const summary = result?.ok ? resultText(tool.slug, result) : "";
  const copy = async () => { try { await navigator.clipboard.writeText(summary); setMessage("Rezultatul a fost copiat."); } catch { setMessage("Nu am putut copia automat. Selectează textul rezultatului."); } };
  const share = async () => { try { if (navigator.share) await navigator.share({ title: tool.title, text: summary, url: window.location.href }); else await copy(); } catch {} };

  return (
    <section className="free-tool-workspace" aria-labelledby="calculator-title">
      <form className="free-tool-form-card" onSubmit={(event) => { event.preventDefault(); calculate(); }}>
        <div className="free-tool-form-head"><div><span className="free-tool-kicker">Calculator gratuit</span><h2 id="calculator-title">Completează datele</h2><p>Rezultatul se calculează direct în browser. Nu salvăm aceste valori.</p></div><button type="button" className="free-tool-reset" onClick={reset} data-usage-event="free_tool_reset"><RefreshCcw size={16} /> Resetează</button></div>
        <ToolFields slug={tool.slug} values={values} setValue={setValue} />
        <button type="submit" className="free-tool-calculate" data-usage-event="free_tool_calculated">Calculează</button>
      </form>
      <div className="free-tool-result-card" aria-live="polite">
        {result?.ok ? <><div className="free-tool-result-head"><div><span className="free-tool-kicker">Rezultatul tău</span><h2>Un plan clar, de ajustat oricând</h2></div><div className="free-tool-result-actions"><button type="button" onClick={copy} aria-label="Copiază rezultatul" data-usage-event="free_tool_result_copied"><Clipboard size={17} /></button><button type="button" onClick={share} aria-label="Distribuie rezultatul" data-usage-event="free_tool_result_shared"><Share2 size={17} /></button></div></div><ResultContent slug={tool.slug} result={result} /><p className="free-tool-formula"><strong>Cum am calculat:</strong> {result.formula}</p><a className="free-tool-cta" href={tool.cta.href} data-usage-event="free_tool_cta_clicked">{tool.cta.label} <span aria-hidden="true">→</span></a></> : <div className="free-tool-empty"><span aria-hidden="true">↗</span><h2>Rezultatul apare aici</h2><p>Completează câmpurile și apasă „Calculează”. Poți schimba valorile oricând.</p></div>}
      </div>
      <p className={result && !result.ok ? "free-tool-message is-error" : "free-tool-message"} role={result && !result.ok ? "alert" : "status"}>{result && !result.ok ? result.error : message}</p>
    </section>
  );
}
