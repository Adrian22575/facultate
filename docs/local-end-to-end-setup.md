# Local End-to-End Setup

Acest ghid acopera setup-ul local complet pentru login, billing, webhook si generare de teste, fara expunerea cheilor secrete in frontend sau in cod.

## 1. Reguli de securitate

- pastreaza `OPENAI_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` si `SUPABASE_SERVICE_ROLE_KEY` doar in `.env.local` sau in env-urile server-side din platforma de deploy
- nu copia chei secrete in `app/*`, `components/*`, `lib/*`, JSON-uri, documentatie sau commit-uri
- daca o cheie secreta a fost distribuita in chat sau in alte canale nesigure, roteste-o inainte de utilizare serioasa

## 2. Variabile locale

Completeaza `.env.local` pornind de la `.env.example`.

Valorile obligatorii pentru setup local:

- `NEXT_PUBLIC_SITE_URL=http://localhost:3000`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `STRIPE_SECRET_KEY`

La primul pas poti lasa:

- `STRIPE_WEBHOOK_SECRET=`

Dupa ce pornesti Stripe CLI, inlocuiesti cu secretul `whsec_...` afisat de listener.

## 3. Supabase

### SQL migrations

In Supabase Dashboard, deschide `SQL Editor` si ruleaza manual, in ordine:

1. `supabase/migrations/0001_saas_foundation.sql`
2. `supabase/migrations/0002_stripe_billing.sql`
3. `supabase/migrations/0003_ai_draft_finalize.sql`
4. `supabase/migrations/0004_rate_limits.sql`
5. `supabase/migrations/0005_academic_communities.sql`
6. `supabase/migrations/0006_seed_academic_institutions.sql`
7. `supabase/migrations/0007_generated_tests_context.sql`
8. `supabase/migrations/0008_subject_catalog.sql`
9. `supabase/migrations/0009_subject_progress.sql`
10. `supabase/migrations/0010_feedback_submissions.sql`
11. `supabase/migrations/0011_admin_users.sql`
12. `supabase/migrations/0012_free_access_allowlist.sql`
13. `supabase/migrations/0013_ai_question_banks.sql`
14. `supabase/migrations/0014_source_documents_storage_backfill.sql`
15. `supabase/migrations/0015_ai_question_bank_review.sql`
16. `supabase/migrations/0016_ai_question_bank_review_delete.sql`
17. `supabase/migrations/0017_openai_request_logs.sql`
18. `supabase/migrations/0018_ai_question_bank_five_answers.sql`
19. `supabase/migrations/0018_increase_ai_source_document_upload_limit.sql`
20. `supabase/migrations/0019_ai_question_bank_needs_review.sql`
21. `supabase/migrations/0020_openai_request_cost_tracking.sql`
22. `supabase/migrations/0021_welcome_pack_benefits.sql`
23. `supabase/migrations/0022_profile_phone_auth.sql`
24. `supabase/migrations/0023_seed_university_faculties.sql`
25. `supabase/migrations/0024_seed_university_programs.sql`
26. `supabase/migrations/0025_restrict_admin_user_email.sql`
27. `supabase/migrations/0026_admin_notification_events.sql`
28. `supabase/migrations/0027_ai_job_timing.sql`
29. `supabase/migrations/0028_ai_import_pipeline.sql`
30. `supabase/migrations/0029_licenta_import_sessions.sql`
31. `supabase/migrations/0030_licenta_import_session_idempotency.sql`
32. `supabase/migrations/0031_referral_rewards.sql`
33. `supabase/migrations/0032_testimonial_reward_submissions.sql`

Pentru fluxul `AI question bank`, migratiile `0013`-`0016` sunt obligatorii.
Migrarea `0017` este recomandata pentru logging si audit OpenAI, dar nu blocheaza procesarea joburilor daca inca lipseste.

Pentru un proiect Supabase mai vechi, daca uploadul din Workspace spune ca lipseste spatiul privat de documente, nu debughezi AI-ul. Rulezi direct:

- `supabase/migrations/0014_source_documents_storage_backfill.sql`

### Verificari dupa migrare

Confirma existenta:

- tabelelor pentru `profiles`, premium access, AI credits, source documents, generated tests, webhook events si rate limits
- tabelelor pentru `institutions`, `academic_units`, `cohorts` si `memberships`
- tabelelor pentru `subjects` si `subject_allocations`
- tabelei `subject_progress`
- tabelei `feedback_submissions`
- tabelei `admin_users`
- bucket-ului `private-source-documents`
- functiilor SQL `get_ai_credit_balance`, `user_has_active_premium` si `create_generated_test_draft`
- tabelelor `ai_question_banks`, `ai_generation_job_chunks` si `ai_question_bank_items`
- functiilor SQL `acquire_ai_generation_job_lock` si `release_ai_generation_job_lock`

Daca bucket-ul `private-source-documents` nu apare in `Storage`, Workspace nu poate salva fisierele urcate si uploadul trebuie blocat pana repari setup-ul.

### Auth local

In `Authentication > URL Configuration`:

- `Site URL` = `http://localhost:3000`
- `Redirect URLs` include `http://localhost:3000/auth/callback`

## 4. Google OAuth

In Google Cloud / Google Auth Platform:

1. creezi un OAuth Client de tip `Web application`
2. setezi `Authorized JavaScript origins` la `http://localhost:3000`
3. setezi `Authorized redirect URIs` la callback-ul Supabase afisat in pagina providerului Google

In `Supabase > Authentication > Providers > Google`:

1. activezi providerul Google
2. completezi `Client ID`
3. completezi `Client Secret`

Implementarea aplicatiei ramane neschimbata: `/auth/login`, `/auth/callback` si `/auth/signout`.

## 5. Stripe local

Instaleaza Stripe CLI pe Windows:

```powershell
winget install Stripe.StripeCLI
```

Dupa instalare, porneste listener-ul local:

```powershell
stripe listen --events checkout.session.completed --forward-to http://localhost:3000/api/stripe/webhook
```

Copiezi secretul `whsec_...` afisat de Stripe CLI in:

- `STRIPE_WEBHOOK_SECRET`

Pentru testarea locala nu este necesar inca un webhook public configurat in Stripe Dashboard.

## 6. Pornire locala

Ruleaza aplicatia:

```powershell
npm run dev
```

Deschide apoi:

- `/setup`
- `/auth/login`
- `/preturi`
- `/cont`
- `/ai`
- `/testele-mele`

In `/setup`, toate check-urile de env trebuie sa apara ca `gata`.
In plus, pasul `Storage fisiere` trebuie sa fie verde.
Pasul `Site URL public` trebuie sa fie verde si sa indice `http://localhost:3000` local.

## 7. Flux minim de validare

### Auth

1. intri in `/auth/login`
2. te autentifici cu Google
3. verifici ca `/cont` devine accesibil
4. faci logout si confirmi ca sesiunea dispare
5. daca este primul login, finalizezi onboarding-ul academic din `/onboarding`

### Billing

1. intri in `/preturi`
2. pornesti un checkout premium
3. platesti in Stripe Sandbox
4. verifici ca Stripe CLI livreaza `checkout.session.completed`
5. verifici in `/cont` ca premium apare activ
6. repeti pentru un produs de credits si confirmi ca soldul creste

### AI

1. intri in `/ai`
2. testezi `TXT`
3. testezi `DOCX`
4. testezi `PDF` cu text selectabil sub 30 MB
5. testezi un fisier peste 30 MB si confirmi respingerea
6. testezi un `PDF` scanat si confirmi mesajul de respingere
7. testezi si text manual suficient de lung
8. confirmi ca dupa generare reusita apar source document, AI job, draft test si consum de exact un credit
9. daca apare mesaj despre lipsa spatiului privat de documente, verifici `/setup` si rulezi `0014_source_documents_storage_backfill.sql`

### Draft review

1. intri in `/ai/drafts/[id]`
2. modifici titlul
3. modifici o intrebare
4. activezi draft-ul
5. verifici in `/testele-mele` ca testul activ apare separat si poate fi rezolvat

### Subject catalog

1. creezi o materie custom noua
2. verifici ca request-ul reuseste fara scriere in `data/questions/*.json`
3. confirmi ca materia exista in catalogul Supabase si nu depinde de filesystem local

## 8. Criterii de acceptare

- `.env.local` contine doar chei locale si este ignorat de git
- toate migratiile `0001`-`0032` sunt aplicate
- onboarding-ul academic seteaza institutia si comunitatea principala
- Google login functioneaza local
- Stripe Checkout + webhook functioneaza local
- `/cont` reflecta premium si credits
- generarea de teste functioneaza cel putin pentru `TXT` si text manual
- bucket-ul `private-source-documents` exista in Supabase Storage
- fisierele peste 30 MB sunt respinse clar
- PDF-urile scanate sunt respinse clar
- draft-ul activat poate fi rezolvat din `/testele-mele`
- materia custom este persistata in Supabase si nu depinde de scrieri locale in repo
