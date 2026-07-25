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

## Frontend and UX workflow

For every frontend, layout, page structure, or redesign task:

### Phase 1: Understand

Before writing code:

1. Read the relevant files from `/docs/design`.
2. Inspect the current page and reusable components.
3. Identify:
   - the user of the page;
   - the primary goal;
   - the primary decision;
   - the primary action;
   - required information;
   - secondary information;
   - information that should be hidden or moved.
4. Do not assume the page should be a dashboard.
5. Do not begin implementation before producing a UX structure proposal.

### Phase 2: Structure

Provide:

1. Page purpose.
2. Primary action.
3. Information hierarchy.
4. Desktop structure.
5. Mobile structure.
6. Tab, modal, drawer, and page separation strategy.
7. Elements to remove, merge, or hide.
8. Three major UX risks.

Do not write implementation code during this phase.

### Phase 3: Wireframe

Create a static wireframe or mockup first.

The wireframe must:

- reuse the existing typography and design system;
- use realistic application data;
- show desktop and mobile layouts;
- contain no invented functionality;
- contain no decorative components without a purpose;
- use one clear primary action.

Do not implement business logic before the wireframe is approved.

### Phase 4: Implementation

After approval:

1. Reuse existing components and tokens.
2. Keep all existing business logic.
3. Do not add unapproved sections or actions.
4. Implement responsive behavior explicitly.
5. Include loading, empty, error, success, and disabled states where relevant.

### Phase 5: Visual QA

After implementation:

1. Run the application.
2. Open the page in a browser.
3. Capture screenshots at:
   - 1440px;
   - 1024px;
   - 768px;
   - 390px.
4. Check:
   - hierarchy;
   - spacing;
   - alignment;
   - overflow;
   - mobile behavior;
   - action visibility;
   - text wrapping;
   - empty space;
   - consistency with the existing site.
5. Fix all visible problems.
6. Repeat screenshots after fixes.
7. Do not mark the task complete without visual QA.

### Mandatory UX constraints

- One primary action per page.
- Maximum two visible secondary actions.
- Do not show secondary information by default.
- Do not use more than one sidebar unless explicitly approved.
- Do not use cards for every section.
- Do not place desktop tables on mobile without a mobile strategy.
- Interactive targets should be at least 44px on mobile.
- No horizontal scrolling on mobile.
- Do not use placeholder text as final content.
- Do not use generic dashboard statistics unless they support a decision.
- Do not add decorative charts without a user need.
