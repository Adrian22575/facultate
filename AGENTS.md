# AGENTS

## Scop

Acest repo contine aplicatia `Teste Facultate`, migrata la Next.js App Router si extinsa spre un produs SaaS cu:

- Google Auth prin Supabase
- Stripe Checkout + webhook
- generare si procesare materiale cu OpenAI in backend
- comunitati academice pentru elevi si studenti
- importuri de seturi pentru licenta

## Reguli rapide pentru agenti

- Nu expune niciodata cheile din `.env.local` in cod, loguri sau documentatie.
- Nu mentiona AI, OpenAI sau credite AI in interfata pentru utilizatorul final. Foloseste "procesare", "generare", "materiale", "incarcari" si "Workspace". Termenii tehnici pot ramane in cod intern, rute/API interne, loguri admin sau documentatie de agent.
- Nu opri si nu porni serverul local doar pentru verificari de rutina. Utilizatorul prefera sa gestioneze serverul din terminal. Ruleaza build/teste headless cand sunt suficiente.
- Cand schimbi schema Supabase, adauga o migrare noua in `supabase/migrations/`.
- Pentru orientare rapida, citeste mai intai:
  - `docs/agent-repo-map.md`
  - `docs/agent-playbook.md`
  - `docs/agent-lessons.md`
- Daca ai nevoie de audit rapid al workspace-ului, ruleaza `npm run workspace:audit`.
- Dupa reorganizari de fisiere sau documentatie de agent, ruleaza `npm run agent:check`.
- Pentru pluginul Supabase, foloseste `docs/supabase-plugin.md`, `npm run supabase:check` si `npm run supabase:check:live`.
- Pentru pluginul OpenAI Developers si verificarea cheilor/modelelor, foloseste `docs/openai-developers-plugin.md` si `npm run openai:check`.
- Pentru workflow-uri repetitive de mentenanta, foloseste skill-ul local `.codex/skills/teste-facultate-maintenance/SKILL.md`.

## Zone sensibile

### Onboarding si comunitati

Daca modifici flow-ul de onboarding sau comunitati, verifica si:

- `app/onboarding`
- `app/auth/callback/route.js`
- `lib/academic/*`
- `lib/private-tests.js`

### Generare, importuri si review de materiale

Daca modifici generarea sau importul de materiale, verifica si:

- `app/api/ai/generate/route.js`
- `app/ai/actions.js`
- `app/api/import/*`
- `app/api/licenta-import/*`
- `lib/ai/*`
- functiile SQL din migratii

### Billing

Daca modifici billing, verifica si:

- `app/api/stripe/*`
- `lib/billing.js`
- `lib/stripe/*`

## Comenzi utile

```powershell
npm run workspace:audit
npm run agent:check
npm run supabase:check
npm run openai:check
npm run build
npm run dev:doctor
npm run local:probe
npm run server:status
```

Comenzi care pot afecta serverul local si trebuie folosite doar cand sunt necesare sau cerute:

```powershell
npm run dev
npm run dev:reset
npm run start:reset
npm run server:stop
```

## Migrații actuale

Ruleaza migratiile Supabase in ordine numerica din `supabase/migrations/`. Nu modifica migratii vechi deja create; adauga una noua pentru schimbari de schema.

## Cand apare o pagina alba in localhost

Semn tipic:

- `/_next/static/...` raspunde cu `404` sau `500`
- logul contine `MODULE_NOT_FOUND` pentru fisiere din `.next`

Remediere, doar daca utilizatorul cere sau daca este crucial pentru verificare:

1. opreste procesul `node` care asculta pe portul folosit
2. sterge folderul `.next`
3. porneste din nou serverul potrivit
