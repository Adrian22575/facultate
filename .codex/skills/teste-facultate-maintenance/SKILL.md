---
name: teste-facultate-maintenance
description: Repo-specific maintenance workflow for the Teste Facultate Next.js app. Use when Codex needs to orient in this repository, audit file structure, reduce workspace clutter, decide whether files are active or legacy, update agent documentation, or verify focused changes without wasting time on unnecessary server restarts.
---

# Teste Facultate Maintenance

## Workflow

1. Read `AGENTS.md`, then `docs/agent-repo-map.md`.
2. Run `npm run workspace:audit` when the task involves cleanup, structure, or context reduction.
3. Treat these as active sources: `app/`, `components/`, `lib/`, `supabase/migrations/`, `data/`, `public/`, `scripts/`, `docs/`.
4. Avoid normal searches in `node_modules/`, `.next/`, `backup/`, screenshots, logs, and downloaded skill repos.
5. Move obsolete local artifacts to `backup/` only after verifying they are not referenced by active source files.
6. Run `npm run agent:check` after changing repo structure, agent docs, or local skills.
7. Prefer `npm run build` for verification. Do not stop or restart local servers unless the user asks or runtime verification truly requires it.

## Product Rules

- Never expose `.env.local` values.
- Do not mention AI, OpenAI, or AI credits in end-user UI. Use product language such as "procesare", "generare", "materiale", "incarcari", and "Workspace".
- Add a new Supabase migration for schema changes.
- Keep changes scoped to the touched flow.

## Reference

Load `references/repo-map.md` only when `docs/agent-repo-map.md` is unavailable or you need the short embedded copy.
