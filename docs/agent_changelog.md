# Agent Changelog (Context Updates)

## 2026-04-11
- Adăugat `assets/common.js` pentru logică reutilizabilă: `getParam`, `fetchJSON`, `shuffleInPlace`, `normalizeQuestions`.
- Refactor pagini (`materii.html`, `subject.html`, `interactive.html`, `test.html`) să folosească utilitarele comune.
- Îmbunătățiri mobile UX în `assets/styles.css`:
  - suport `safe-area` pentru dispozitive cu notch;
  - stil standard pentru descrieri;
  - acțiuni quiz sticky pe mobil.
- Mutat stilurile paginii de simulare licență în fișier dedicat `assets/licenta-exam.css` pentru organizare mai bună.
- Adăugat badge de versiune pe `index.html` în colțul din dreapta-jos, cu dată/oră update vizibile pentru verificare rapidă.
- Badge-ul de versiune afișează acum timpul în fusul orar local al utilizatorului (nu doar UTC fix).
- Upgrade UX/UI către experiență de tip aplicație: header mai clar pe prima pagină, căutare + filtrare materii, carduri explicative pentru modurile unei materii.
- Adăugat `data/app-data.js` ca fallback static pentru rulare directă din `file://`, astfel încât paginile care citeau JSON prin `fetch` să funcționeze și fără server local.
- Refăcut UI/UX în direcție academică statică: shell comun de aplicație, liste și acțiuni mai clare, moduri de lucru aliniate vizual și fără dependențe vizuale externe.
- Actualizat badge-ul aplicației la `v2.3` pentru refacerea UI/UX.
- Adăugat flux mobile-first pentru `Continuă rapid` prin `localStorage` și revizuire locală a greșelilor în Test/Interactiv.

> Notă pentru agenți: menține acest jurnal scurt, orientat pe decizii arhitecturale/UX relevante pentru task-uri viitoare.
