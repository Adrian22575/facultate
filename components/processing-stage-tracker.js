import { Check, LoaderCircle } from "lucide-react";

const PROCESSING_FLOWS = {
  learning: [
    { label: "Material salvat", states: ["draft", "uploaded", "queued"] },
    { label: "Citim conținutul", states: ["extracting"] },
    { label: "Pregătim modurile", states: ["outlining", "generating"] },
    { label: "Verificăm rezultatul", states: ["consolidating", "finalizing"] }
  ],
  questions: [
    { label: "Verificam fisierul", states: ["pending", "profiling"] },
    { label: "Extragem intrebarile", states: ["extracting"] },
    { label: "Verificam raspunsurile", states: ["consolidating"] },
    { label: "Pregatim pentru verificare", states: ["publishing", "review"] }
  ],
  import: [
    { label: "Pregatim fisierul", states: ["uploaded"] },
    { label: "Citim continutul", states: ["extracting", "chunking"] },
    { label: "Potrivim intrebarile", states: ["processing", "matching_answers"] },
    { label: "Pregatim rezultatul", states: ["ready_for_preview", "completed"] }
  ]
};

function getFlow(kind) {
  return PROCESSING_FLOWS[kind] || PROCESSING_FLOWS.questions;
}

function getActiveIndex({ flow, stage, status }) {
  if (["succeeded", "completed", "ready_for_preview"].includes(status)) {
    return flow.length;
  }

  const state = stage || status || "";
  const index = flow.findIndex((item) => item.states.includes(state));
  return index >= 0 ? index : 0;
}

export function ProcessingStageTracker({ kind = "questions", stage, status }) {
  const flow = getFlow(kind);
  const activeIndex = getActiveIndex({ flow, stage, status });
  const statusLabel = activeIndex >= flow.length
    ? "Procesare finalizată."
    : `Etapa ${activeIndex + 1} din ${flow.length}: ${flow[activeIndex].label}.`;

  return (
    <>
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{statusLabel}</p>
      <ol className="processing-stage-tracker" aria-label="Etapele procesării">
        {flow.map((item, index) => {
          const isDone = activeIndex > index;
          const isActive = activeIndex === index;

          return (
            <li
              key={item.label}
              className={`${isDone ? "is-done" : ""}${isActive ? " is-active" : ""}`}
              aria-current={isActive ? "step" : undefined}
            >
              <span className="processing-stage-tracker-icon" aria-hidden="true">
                {isDone ? <Check size={15} strokeWidth={2.8} /> : null}
                {isActive ? <LoaderCircle size={15} strokeWidth={2.4} /> : null}
                {!isDone && !isActive ? <span /> : null}
              </span>
              <span>{item.label}</span>
            </li>
          );
        })}
      </ol>
    </>
  );
}
