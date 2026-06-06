# Workspace Cleanup - 2026-06-02

Scop: reducerea zgomotului din radacina proiectului si a consumului de context pentru agenti.

## Mutat in backup local

Destinatie:

```text
backup/2026-06-02-workspace-cleanup/
```

Categorii mutate:

- fisiere HTML statice legacy: `index.html`, `materii.html`, `subject.html`, `study.html`, `interactive.html`, `test.html`, `licenta-exam.html`
- asset-uri statice legacy: `assets/`, `js/`
- repo-uri de skill-uri descarcate pentru explorare: `anthropics-skills/`, `awesome-codex-skills/`
- loguri locale: `*.log` de la radacina
- artefacte locale: `recovery-summary.json`
- screenshot-uri QA locale: `email-login*.png`

## De ce este sigur

- Aplicatia activa ruleaza prin Next.js App Router.
- Rutele legacy `.html` sunt acoperite de redirecturi in `next.config.mjs` sau pagini redirect in `app/*.html/page.js`.
- `backup/` este ignorat de git si ramane disponibil local pentru recuperare.

## Verificare recomandata

```powershell
npm run workspace:audit
npm run agent:check
npm run build
```
