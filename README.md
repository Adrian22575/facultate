# Teste Facultate – ghid rapid

## Structură proiect
- `index.html` – meniu principal.
- `materii.html` – listă materii din `data/subjects.json`.
- `subject.html` – alege modul pentru o materie.
- `study.html` – mod studiu.
- `interactive.html` – mod interactiv.
- `test.html` – test configurabil pe materie.
- `licenta-exam.html` + `js/licenta-exam.js` – simulare examen licență (toate materiile).
- `assets/styles.css` – stiluri globale (mobile-first).
- `assets/licenta-exam.css` – stiluri dedicate paginii de licență.
- `assets/common.js` – utilitare JS comune (fără duplicare).

## subjects.json
Fișierul `data/subjects.json` controlează meniul de materii.
Pentru a adăuga o materie nouă:
1) adaugi un obiect în `subjects` cu:
   - `id` (unic, fără spații, ex: `econometrie`)
   - `title` (afișat în UI)
   - `questionsFile` (calea către fișierul de întrebări)
2) creezi fișierul de întrebări în `data/questions/`

Exemplu:
```json
{
  "id": "econometrie",
  "title": "Econometrie",
  "questionsFile": "data/questions/econometrie.json"
}
```

## Format fișier întrebări
Fiecare fișier din `data/questions/*.json` arată așa:
```json
{
  "questions": [
    {
      "id": 1,
      "text": "Întrebarea ...",
      "answers": ["a) ...", "b) ...", "c) ..."],
      "correctIndex": 2,
      "difficulty": 1
    }
  ]
}
```

Notă:
- `correctIndex` este 0-based (`a=0`, `b=1`, `c=2`, ...).
- Nu folosi comentarii `//` în JSON (nu e valid).

## Context pentru agenți AI
- Context și reguli de mentenanță: `docs/AGENT_CONTEXT.md`.
- Istoric schimbări relevante pentru agenți: `docs/agent_changelog.md`.
