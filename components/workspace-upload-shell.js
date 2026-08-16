import { moduleClassNames } from "@/lib/ui/module-class-names";
import styles from "./workspace-upload-shell.module.css";
import sourceStyles from "./workspace-source-input.module.css";
import { AppHeader } from "@/components/app-header";
import { PendingNavigationLink } from "@/components/pending-navigation-link";
import { FileQuestion, GraduationCap } from "lucide-react";

export function WorkspaceUploadShell({
  title,
  subtitle,
  backHref = "/materiale",
  backLabel = "Inapoi la materiale",
  meta = [],
  variant = "learning",
  children,
  alerts = null
}) {
  const HeroIcon = variant === "licenta" ? GraduationCap : FileQuestion;
  const showVisual = variant === "test" || variant === "licenta";

  return (
    <main className={moduleClassNames([styles, sourceStyles], "app-shell learning-upload-page workspace-flow-page workspace-import-page")}>
      <AppHeader
        action={
          <PendingNavigationLink
            className={moduleClassNames([styles, sourceStyles], "btn-back")}
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

      <section className={moduleClassNames([styles, sourceStyles], `workspace-import-hero${meta.length ? "" : " is-simple"}`)}>
        <div className={moduleClassNames([styles, sourceStyles], "workspace-import-hero-copy")}>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        {meta.length || showVisual ? (
          <div className={moduleClassNames([styles, sourceStyles], `workspace-import-hero-aside is-${variant}`)}>
            {showVisual ? (
              <span className={moduleClassNames([styles, sourceStyles], "workspace-import-hero-icon")} aria-hidden="true">
                <HeroIcon size={34} strokeWidth={1.9} />
              </span>
            ) : null}
            <div className={moduleClassNames([styles, sourceStyles], "workspace-import-meta")} aria-label="Detalii rapide">
              {meta.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <section className={moduleClassNames([styles, sourceStyles], "workspace-flow-main")} aria-label={title}>{children}</section>
    </main>
  );
}
