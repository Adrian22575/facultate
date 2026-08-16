import { moduleClassNames } from "@/lib/ui/module-class-names";
import { Braces, Search, ShieldCheck } from "lucide-react";

import promptStyles from "./admin-generation-prompt-preview.module.css";

function toolLabel(tool) {
  return tool === "web_search" ? "Căutare web" : tool;
}

export function AdminGenerationPromptPreview({ preview }) {
  if (!preview?.requests?.length) return null;

  return (
    <details className={moduleClassNames(promptStyles, "admin-generation-preview")}>
      <summary>Vezi instrucțiunile trimise la generare</summary>
      <div className={moduleClassNames(promptStyles, "admin-generation-preview-body")}>
        <p>Cheia API nu este afișată. Sunt incluse modelul, instrucțiunile, contextul și rezultatul așteptat pentru fiecare cerere.</p>
        <div className={moduleClassNames(promptStyles, "admin-generation-preview-meta")}>
          <span>Model: <strong>{preview.model}</strong></span>
          <span>Fus orar: <strong>{preview.timezone}</strong></span>
        </div>
        <div className={moduleClassNames(promptStyles, "admin-generation-preview-list")}>
          {preview.requests.map((request, index) => (
            <article key={request.id}>
              <header>
                <span>{index + 1}</span>
                <div><strong>{request.title}</strong><small>Raționare: {request.reasoning} · Rezultat: {request.output}</small></div>
              </header>
              {request.tools?.length ? <p className={moduleClassNames(promptStyles, "admin-generation-preview-tools")}><Search size={14} />Instrument: {request.tools.map(toolLabel).join(", ")}</p> : null}
              <section>
                <span><Braces size={14} />Instrucțiuni</span>
                <pre>{request.developerPrompt}</pre>
              </section>
              {request.userPrompt ? <section>
                <span><Braces size={14} />Mesaj de pornire</span>
                <pre>{request.userPrompt}</pre>
              </section> : null}
              {request.dynamicContext ? <p className={moduleClassNames(promptStyles, "admin-generation-preview-context")}><ShieldCheck size={14} />{request.dynamicContext}</p> : null}
            </article>
          ))}
        </div>
        {preview.retryNote ? <p className={moduleClassNames(promptStyles, "admin-generation-preview-note")}>{preview.retryNote}</p> : null}
        {preview.publication ? <p className={moduleClassNames(promptStyles, "admin-generation-preview-note")}>{preview.publication}</p> : null}
      </div>
    </details>
  );
}
