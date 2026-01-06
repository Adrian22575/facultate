# Data (materii + întrebări)

## subjects.json
Fișierul `data/subjects.json` controlează meniul de materii.
Pentru a adăuga o materie nouă:
1) adaugi un obiect în `subjects` cu:
   - id (unic, fără spații, ex: "econometrie")
   - title (afișat în UI)
   - questionsFile (calea către fișierul de întrebări)
2) creezi fișierul de întrebări în `data/questions/`

Exemplu:
{
  "id": "econometrie",
  "title": "Econometrie",
  "questionsFile": "data/questions/econometrie.json"
}

## Format fișier întrebări
Fiecare fișier din `data/questions/*.json` arată așa:
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

Notă:
- `correctIndex` este 0-based (a=0, b=1, c=2, ...).
- Nu se folosesc comentarii `//` în JSON (nu e valid).
