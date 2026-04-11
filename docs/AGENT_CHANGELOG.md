# Agent Changelog (Context Updates)

## 2026-04-11
- Adăugat `assets/common.js` pentru logică reutilizabilă: `getParam`, `fetchJSON`, `shuffleInPlace`, `normalizeQuestions`.
- Refactor pagini (`materii.html`, `subject.html`, `interactive.html`, `test.html`) să folosească utilitarele comune.
- Îmbunătățiri mobile UX în `assets/styles.css`:
  - suport `safe-area` pentru dispozitive cu notch;
  - stil standard pentru descrieri;
  - acțiuni quiz sticky pe mobil.
- Mutat stilurile paginii de simulare licență în fișier dedicat `assets/licenta-exam.css` pentru organizare mai bună.

> Notă pentru agenți: menține acest jurnal scurt, orientat pe decizii arhitecturale/UX relevante pentru task-uri viitoare.
