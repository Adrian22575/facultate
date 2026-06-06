# Agent Playbook

Workflow scurt pentru lucru rapid si sigur in repo.

## 1. Orientare initiala

Citeste in ordine:

1. `AGENTS.md`
2. `docs/agent-repo-map.md`
3. `docs/agent-lessons.md` daca task-ul atinge zone sensibile sau localhost

Ruleaza auditul doar cand ai nevoie de structura sau curatenie:

```powershell
npm run workspace:audit
```

Dupa reorganizari de fisiere, documente sau skill-uri:

```powershell
npm run agent:check
```

## 2. Straturi principale

- `app/*` - rute Next.js, API routes, pagini si server actions.
- `components/*` - UI React.
- `lib/*` - logica produsului si integrari.
- `supabase/migrations/*` - schema si RLS.
- `docs/*` - context pentru agenti si setup.

## 3. Fluxuri importante

### Login si onboarding

- intrarea principala este `/auth/login`
- callback-ul este in `app/auth/callback/route.js`
- onboarding-ul este in `app/onboarding`
- logica academica este in `lib/academic/*`

### Materiale si importuri

- `/materiale` este ruta publica de produs si rescrie catre `/ai`
- generarea este in `app/api/ai/*` si `lib/ai/*`
- importurile de seturi sunt in `app/api/import/*`
- finalizarea licentei este in `app/api/licenta-import/*`

### Teste si materii

- materii: `app/materii/*`
- testele utilizatorului: `app/testele-mele/*`
- fallback local: `data/subjects.json` si `data/questions/*`

### Admin

- UI: `app/admin/page.js` si `components/admin-*`
- notificari: `lib/admin-notification-*` si `app/api/admin/notification-views/route.js`

## 4. Reguli de schimbare

- Nu modifica migratii vechi; adauga migrare noua.
- Nu expune `.env.local`.
- Nu mentiona AI/OpenAI/credite AI in UI final.
- Nu opri serverul local pentru verificari de rutina. Utilizatorul gestioneaza serverul.
- Daca un bug e pe runtime local, separa build-ul de problema de server/cache.

## 5. Verificare

Pentru majoritatea schimbarilor:

```powershell
npm run build
```

Pentru probleme locale fara restart:

```powershell
npm run dev:doctor
npm run local:probe
npm run server:status
npm run agent:check
```

Foloseste restart/reset doar cand este cerut sau absolut necesar.

## 6. Curatenie workspace

Artefacte locale ignorate:

- `backup/`
- `.next/`
- `node_modules/`
- `*.log`
- screenshot-uri de QA
- foldere de skill-uri descarcate pentru explorare

Nu cauta in ele decat daca task-ul cere explicit.
