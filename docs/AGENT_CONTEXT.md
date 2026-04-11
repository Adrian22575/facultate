# Agent Context – Teste Facultate

## Scop proiect
Aplicație web statică pentru învățare și testare la materii de facultate (moduri: Study, Interactiv, Test, Simulare Licență).

## Arhitectură rapidă
- `index.html` – meniul principal.
- `materii.html` – listă materii din `data/subjects.json`.
- `subject.html` – hub pentru modurile unei materii.
- `study.html` / `interactive.html` / `test.html` – moduri pe materie.
- `licenta-exam.html` + `js/licenta-exam.js` – simulare examen global.
- `assets/styles.css` – stiluri globale responsive.
- `assets/licenta-exam.css` – stiluri dedicate paginii de simulare.
- `assets/common.js` – utilitare partajate (query params, fetch JSON, shuffle, normalizare întrebări).

## Reguli de performanță / cost context pentru agenți
1. **Reutilizează utilitarele din `assets/common.js`** în loc să dublezi funcții inline.
2. **Păstrează paginile mobile-first** (touch targets min. ~44px, layout simplu, fără dependențe grele).
3. **Evită framework-uri noi** pentru schimbări mici; proiectul este static și trebuie să rămână ieftin la rulare.
4. **Datele rămân în JSON** în `data/questions/` și `data/subjects.json`.
5. **Schimbări UX**: preferă ajustări în CSS global, nu stiluri inline duplicate.

## Checklist când modifici codul
- [ ] Dacă ai introdus pattern reutilizabil, adaugă-l în `assets/common.js`.
- [ ] Dacă ai schimbat UX pe mobil, verifică `@media (max-width: 600px)`.
- [ ] Dacă ai schimbat structura paginilor, actualizează secțiunea „Arhitectură rapidă” din acest fișier.
- [ ] Dacă ai schimbat fluxuri importante, adaugă notă în `docs/agent_changelog.md`.
