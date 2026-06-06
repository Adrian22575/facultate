# Agent Changelog

Pastreaza acest jurnal scurt si orientat pe decizii care ajuta agentii viitori.

## 2026-06-02

- Curatat radacina repo-ului dupa migrarea la Next.js: fisierele statice legacy, logurile locale, screenshot-urile QA si repo-urile de skill-uri descarcate au fost mutate in `backup/2026-06-02-workspace-cleanup/`.
- Adaugat `docs/agent-repo-map.md` pentru orientare rapida in structura activa.
- Actualizate `AGENTS.md`, `README.md`, `docs/AGENT_CONTEXT.md` si `docs/agent-playbook.md` ca sa reflecte structura Next.js curenta.
- Adaugat `npm run workspace:audit` pentru audit read-only al folderelor mari si al artefactelor locale.
- Adaugat skill local `.codex/skills/teste-facultate-maintenance/` pentru workflow-uri repetitive de mentenanta.

## 2026-05-01

- Aplicatia intra prin login-first flow: `/` redirectioneaza spre `/auth/login` sau `/cont`.
- Adaugat onboarding academic national pentru elevi si studenti in `/onboarding`.
- Adaugata migrarea `0005_academic_communities.sql` pentru institutii, unitati academice, cohorte si memberships.
- Testele generate sunt pregatite implicit pentru share pe cohorta.
- `Testele mele` afiseaza atat testele proprii, cat si testele active din comunitatea utilizatorului.
- Adaugate `AGENTS.md`, `docs/agent-playbook.md` si `docs/agent-lessons.md` pentru orientare rapida si reducerea erorilor repetabile.
- Adaugata migrarea `0006_seed_academic_institutions.sql` cu institutii seed.

## 2026-04-11

- Adaugat `assets/common.js` pentru logica reutilizabila in versiunea statica legacy.
- Refactor pentru paginile statice `materii.html`, `subject.html`, `interactive.html`, `test.html`.
- Imbunatatiri mobile UX in `assets/styles.css`.
- Mutat stilurile paginii de simulare licenta in `assets/licenta-exam.css`.
- Adaugat badge de versiune pe `index.html`.
- Adaugat `data/app-data.js` ca fallback static pentru rulare directa din `file://`.
- Refacut UI/UX in directie academica statica.
