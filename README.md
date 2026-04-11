# Teste Facultate

Aplicatie web statica pentru invatare si testare la materiile de facultate.

Nu are backend, baza de date, build step sau dependinte care trebuie instalate in proiect. Fisierele HTML, CSS, JS si JSON pot fi puse direct pe GitHub.

## Cum ruleaza colegii aplicatia

Varianta recomandata este GitHub Pages, gratuit pentru un site static si fara domeniu cumparat.

URL-ul va arata aproximativ asa:

```text
https://Adrian22575.github.io/facultate/
```

Pasii in GitHub:

1. Intra in repository.
2. Deschide `Settings`.
3. In stanga, intra la `Pages`.
4. La `Build and deployment`, alege `Deploy from a branch`.
5. Alege branch-ul `main` si folderul `/ (root)`.
6. Apasa `Save`.
7. Dupa cateva minute, GitHub afiseaza linkul public al aplicatiei.

Colegii vor putea intra pe acel link direct din browser. Nu trebuie sa instaleze nimic.

## Testare locala

Poti deschide `index.html` direct in browser pentru o verificare rapida.

Pentru testare cat mai apropiata de GitHub Pages, foloseste un server local simplu. De exemplu, daca ai Python instalat:

```powershell
python -m http.server 8000
```

Apoi deschide:

```text
http://localhost:8000/
```

Acest server local este doar pentru testare pe calculatorul tau. Nu este necesar pentru GitHub Pages si nu devine o dependinta a aplicatiei.

## Structura proiect

- `index.html` - meniu principal.
- `materii.html` - lista materii din `data/subjects.json`.
- `subject.html` - alege modul pentru o materie.
- `study.html` - mod studiu.
- `interactive.html` - mod interactiv.
- `test.html` - test configurabil pe materie.
- `licenta-exam.html` + `js/licenta-exam.js` - simulare examen licenta.
- `assets/styles.css` - stiluri globale.
- `assets/licenta-exam.css` - stiluri dedicate paginii de licenta.
- `assets/common.js` - utilitare JS comune.
- `data/app-data.js` - copia JS a datelor JSON, folosita ca fallback cand aplicatia este deschisa direct din folder.

## Adaugare materie

Fisierul `data/subjects.json` controleaza meniul de materii.

Pentru o materie noua:

1. Adauga un obiect in `subjects`.
2. Creeaza fisierul de intrebari in `data/questions/`.

Exemplu:

```json
{
  "id": "econometrie",
  "title": "Econometrie",
  "questionsFile": "data/questions/econometrie.json"
}
```

## Format intrebari

Fiecare fisier din `data/questions/*.json` foloseste formatul:

```json
{
  "questions": [
    {
      "id": 1,
      "text": "Intrebarea ...",
      "answers": ["a) ...", "b) ...", "c) ..."],
      "correctIndex": 2,
      "difficulty": 1
    }
  ]
}
```

Note:

- `correctIndex` este 0-based: `a=0`, `b=1`, `c=2`.
- Nu folosi comentarii `//` in JSON, pentru ca JSON-ul nu le accepta.
- Daca modifici fisierele JSON manual, actualizeaza si `data/app-data.js`, ca aplicatia sa mearga si direct din folder.

## Context pentru agenti AI

- Context si reguli de mentenanta: `docs/AGENT_CONTEXT.md`.
- Istoric schimbari relevante: `docs/agent_changelog.md`.
