# OpenAI Developers Plugin

Ghid intern pentru folosirea pluginului prebuilt `OpenAI Developers` in acest workspace.

## Status verificat

- Pluginul este disponibil in sesiunea Codex.
- Connectorul poate lista tintele pentru chei API.
- Tinta vazuta: organizatia `Personal`, proiectul `Default project`.
- `.env.local` are `OPENAI_API_KEY` setat.
- Cheia locala si modelele default au fost verificate live cu `npm run openai:check:live`.

## Cum se foloseste in practica

Aplicatia nu citeste cheia direct din plugin. Runtime-ul Next.js citeste cheia din env server-side:

```text
OPENAI_API_KEY
```

Pluginul este util pentru creare/rotire chei API prin connectorul OpenAI Developers. Dupa creare, cheia trebuie salvata doar in:

- `.env.local` pentru local
- env server-side in platforma de deploy

Nu salva cheia in cod, docs sau fisiere publice.

## Verificari locale

Verifica prezenta cheii si modelele configurate, fara apel live:

```powershell
npm run openai:check
```

Verifica live cheia si accesul la modelele configurate:

```powershell
npm run openai:check:live
```

Acest live check foloseste `models.retrieve`, nu genereaza continut.

## Variabile OpenAI

Variabilele documentate in `.env.example` acopera:

- import seturi licenta
- fallback PDF
- procesare PDF single-file
- procesare PDF pe batch-uri

Modelele default actuale:

```text
OPENAI_IMPORT_MODEL=gpt-5.4-mini
OPENAI_IMPORT_ESCALATION_MODEL=gpt-5.4
OPENAI_PDF_FALLBACK_MODEL=gpt-5.4
OPENAI_PDF_PRIMARY_MODEL=gpt-5.4
OPENAI_PDF_ESCALATION_MODEL=gpt-5.4
```

## Cand creezi o cheie noua

Creeaza o cheie noua doar daca:

- `OPENAI_API_KEY` lipseste
- cheia existenta a fost revocata
- vrei rotire intentionata

Dupa rotire, ruleaza:

```powershell
npm run openai:check:live
npm run build
```
