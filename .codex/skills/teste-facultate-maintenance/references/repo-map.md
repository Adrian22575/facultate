# Teste Facultate Repo Map

Active source:

- `app/` - Next.js App Router pages and API routes.
- `components/` - React UI.
- `lib/` - product logic and integrations.
- `supabase/migrations/` - database schema and RLS.
- `data/` - local fallback data.
- `public/` - public assets.
- `scripts/` - maintenance and diagnostics.
- `docs/` - agent context.

Avoid unless explicitly needed:

- `node_modules/`
- `.next/`
- `backup/`
- root logs and screenshots
- downloaded skill repository folders

Useful command:

```powershell
npm run workspace:audit
```
