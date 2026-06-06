# Supabase Plugin

Ghid intern pentru folosirea pluginului prebuilt `Supabase` in acest workspace.

## Status verificat

- Pluginul este disponibil in sesiunea Codex.
- Proiectul conectat este `facultate-app`.
- Project ref: `okhgfdgyeiszphadykgb`.
- Status proiect: `ACTIVE_HEALTHY`.
- Regiune: `eu-central-1`.
- Database: Postgres 17.
- `.env.local` pointeaza catre acelasi project ref.
- `.env.local` are:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
- Publishable key-ul local este de tip modern `sb_publishable_*`.

## Cum se foloseste in practica

Aplicatia citeste Supabase din env:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY
```

Pluginul este util pentru:

- listarea proiectelor conectate
- verificarea tabelelor si RLS
- verificarea migratiilor vazute de Supabase
- generarea de types
- inspectarea edge functions
- citirea cheilor publishable

Nu folosi actiuni destructive precum pause/restore fara cerere explicita.

## Verificari locale

Check rapid fara apel live:

```powershell
npm run supabase:check
```

Check live read-only cu service role:

```powershell
npm run supabase:check:live
```

Live check-ul verifica:

- ref-ul proiectului din URL
- tipul publishable key
- prezenta service role
- tabele cheie ale aplicatiei
- bucket-ul `private-source-documents`

## Observatie despre migratii

Pluginul Supabase raporteaza momentan `0` migratii in baza de date, dar tabelele aplicatiei exista si sunt vizibile. Asta inseamna ca schema a fost probabil aplicata prin SQL manual sau alt mecanism, nu prin tracking-ul Supabase CLI migrations.

Pentru schimbari noi:

- adauga mereu fisier nou in `supabase/migrations/`
- nu modifica migratii vechi
- dupa aplicare, verifica prin plugin tabelele afectate

## Schema importanta

Tabele critice vazute prin plugin:

- `profiles`
- `memberships`
- `institutions`
- `academic_units`
- `cohorts`
- `subjects`
- `subject_allocations`
- `ai_source_documents`
- `ai_generation_jobs`
- `ai_question_banks`
- `ai_question_bank_items`
- `ai_import_jobs`
- `ai_import_questions`
- `ai_import_answer_options`
- `ai_licenta_import_sessions`
- `openai_request_logs`
- `admin_notification_events`
- `admin_notification_views`

Storage:

- `private-source-documents`

Edge functions:

- niciuna configurata momentan
