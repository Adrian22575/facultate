# Agent Repo Map

Harta scurta pentru orientare rapida in `Teste Facultate`.

## Surse active

- `app/` - App Router, pagini, server actions si API routes.
- `components/` - UI reutilizabil. Componentele client au `"use client"`.
- `lib/` - logica de produs si integrari.
- `lib/ai/` - generare, import, review si pipeline-uri de materiale.
- `lib/supabase/` - clienti Supabase server/client/admin.
- `lib/stripe/` - planuri si client Stripe.
- `lib/academic/` - comunitati academice si setup onboarding.
- `supabase/migrations/` - sursa autoritara pentru schema si RLS.
- `data/` - fallback local pentru materii si intrebari statice.
- `public/` - asset-uri servite public.
- `scripts/` - verificari locale si mentenanta.

## Rute produs

- `/materiale` rescrie catre `/ai`.
- `/materii` si `/materii/[subjectId]` sunt zonele pentru materii.
- `/testele-mele` listeaza testele utilizatorului si cele din comunitate.
- `/admin` contine tabelele si alertele admin.
- `/auth/*`, `/onboarding`, `/cont` sunt fluxurile de autentificare si profil.

## Rute/API sensibile

- `app/api/ai/*` - generare materiale.
- `app/api/import/*` - import seturi si review intrebari.
- `app/api/licenta-import/*` - sesiuni si finalizare licenta.
- `app/api/stripe/*` - checkout si webhook.
- `app/api/admin/*` - admin center.

## OpenAI Developers plugin

- setup intern: `docs/openai-developers-plugin.md`
- env/check local: `npm run openai:check`
- live model access check: `npm run openai:check:live`

## Supabase plugin

- setup intern: `docs/supabase-plugin.md`
- project ref: `okhgfdgyeiszphadykgb`
- env/check local: `npm run supabase:check`
- live read-only check: `npm run supabase:check:live`

## Legacy si backup

Fisierele HTML/CSS/JS statice vechi nu sunt sursa activa. Rutele legacy sunt acoperite prin `next.config.mjs` si pagini redirect in `app/*.html/page.js`.

Arhiva locala este in `backup/` si este ignorata de git. Nu citi tot backup-ul decat daca investighezi explicit o regresie fata de versiunea statica veche.

## Comenzi eficiente

```powershell
npm run workspace:audit
npm run agent:check
npm run build
npm run dev:doctor
npm run local:probe
```

Evita restarturile de server daca build-ul sau verificarea headless este suficienta.

## Regula de context

Pentru task-uri normale, incepe cu:

1. `AGENTS.md`
2. acest fisier
3. `docs/agent-lessons.md` doar daca atingi o zona sensibila sau localhost se comporta ciudat

Nu incarca foldere mari (`node_modules`, `.next`, `backup`) in cautari decat daca ai un motiv clar.
