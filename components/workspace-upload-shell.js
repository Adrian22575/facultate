import Link from "next/link";

import { AppHeader } from "@/components/app-header";

export function WorkspaceUploadShell({
  title,
  subtitle,
  eyebrow = "Workspace",
  backHref = "/materiale",
  backLabel = "Inapoi la Workspace",
  meta = [],
  steps = [],
  children,
  alerts = null
}) {
  return (
    <main className="app-shell learning-upload-page workspace-flow-page workspace-import-page">
      <AppHeader
        action={
          <Link className="btn-back" href={backHref}>
            {backLabel}
          </Link>
        }
        title={title}
        subtitle={subtitle}
        hidePageTitle
      />

      {alerts}

      <section className="workspace-import-hero">
        <div className="workspace-import-hero-copy">
          <span className="ui-section-label">{eyebrow}</span>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        {meta.length ? (
          <div className="workspace-import-meta" aria-label="Detalii rapide">
            {meta.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        ) : null}
      </section>

      <section className="learning-upload-layout workspace-flow-layout workspace-import-layout">
        <section className="workspace-flow-main" aria-label={title}>
          {children}
        </section>

        {steps.length ? (
          <aside className="learning-upload-side workspace-flow-side workspace-import-side">
            <section className="surface learning-upload-side-card workspace-import-steps-card">
              <div className="learning-upload-section-head">
                <div>
                  <span className="ui-section-label">Pasii</span>
                  <h2>Ce urmeaza</h2>
                </div>
              </div>
              <ol className="workspace-import-steps">
                {steps.map((step, index) => (
                  <li key={step}>
                    <span>{index + 1}</span>
                    <p>{step}</p>
                  </li>
                ))}
              </ol>
            </section>
          </aside>
        ) : null}
      </section>
    </main>
  );
}
