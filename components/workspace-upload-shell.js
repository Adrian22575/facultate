import { AppHeader } from "@/components/app-header";
import { PendingNavigationLink } from "@/components/pending-navigation-link";

export function WorkspaceUploadShell({
  title,
  subtitle,
  backHref = "/materiale",
  backLabel = "Inapoi la materiale",
  meta = [],
  children,
  alerts = null
}) {
  return (
    <main className="app-shell learning-upload-page workspace-flow-page workspace-import-page">
      <AppHeader
        action={
          <PendingNavigationLink
            className="btn-back"
            href={backHref}
            pendingLabel="Se revine la materiale..."
            pendingMode="replace"
          >
            {backLabel}
          </PendingNavigationLink>
        }
        title={title}
        subtitle={subtitle}
        hidePageTitle
      />

      {alerts}

      <section className={`workspace-import-hero${meta.length ? "" : " is-simple"}`}>
        <div className="workspace-import-hero-copy">
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

      <section className="workspace-flow-main" aria-label={title}>{children}</section>
    </main>
  );
}
