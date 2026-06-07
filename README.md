# Teste Facultate

Aplicatie Next.js App Router pentru invatare, testare, materiale generate, importuri de seturi pentru licenta, comunitati academice, autentificare Supabase si billing Stripe.

## Start rapid

```powershell
npm install
npm run build
```

Pentru dezvoltare locala:

```powershell
npm run dev
```

In acest workspace serverul local este gestionat de obicei manual din terminal. Agentii trebuie sa evite restarturile daca nu sunt cruciale pentru verificare.

## Structura activa

- `app/` - rute Next.js App Router, API routes si pagini.
- `components/` - componente React client/server.
- `lib/` - logica de produs, Supabase, billing, importuri si generare.
- `supabase/migrations/` - schema, RLS si functii SQL.
- `data/` - fallback local si intrebari statice ramase utile.
- `public/` - imagini si asset-uri publice.
- `scripts/` - verificari locale si automatizari.
- `docs/` - context pentru agenti, setup si decizii.

## Orientare pentru agenti

Citeste:

- `AGENTS.md`
- `docs/agent-repo-map.md`
- `docs/agent-playbook.md`
- `docs/agent-lessons.md`

Audit rapid:

```powershell
npm run workspace:audit
npm run agent:check
```

Skill local pentru mentenanta:

```text
.codex/skills/teste-facultate-maintenance/SKILL.md
```

OpenAI Developers plugin:

```powershell
npm run openai:check
npm run openai:check:live
```

Detalii: `docs/openai-developers-plugin.md`.

Supabase plugin:

```powershell
npm run supabase:check
npm run supabase:check:live
```

Detalii: `docs/supabase-plugin.md`.


## Publicare

Aplicatia completa trebuie publicata pe Vercel sau pe o alta platforma care ruleaza Next.js cu Node.js runtime. GitHub Pages serveste doar fisiere statice si nu poate rula autentificarea, API routes, procesarea de materiale sau platile din aplicatie.

Daca GitHub Pages afiseaza `404 File not found`, vezi `docs/github-pages.md`. Repository-ul contine `index.html` si `404.html` doar ca fallback static pentru configurari accidentale de Pages, nu ca deploy principal al aplicatiei.

## Note despre fisiere legacy

Versiunea statica veche cu fisiere HTML/CSS/JS la radacina a fost arhivata in `backup/` cand aplicatia a devenit Next.js. Rutele legacy sunt pastrate prin redirecturi/rute Next, nu prin fisierele HTML vechi.

`backup/` este ignorat de git si trebuie tratat ca arhiva locala, nu ca sursa activa.
