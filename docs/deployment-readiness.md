# Deployment Readiness

Acest ghid descrie ordinea recomandata pentru a porni proiectul local si pentru a-l publica pe Vercel fara pasi lipsa.

Pentru un flux local end-to-end, vezi si `docs/local-end-to-end-setup.md`.

Nota de securitate:

- cheile `OPENAI_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, cheile Stripe sandbox si `SUPABASE_SERVICE_ROLE_KEY` trebuie sa existe doar server-side
- daca astfel de chei au fost distribuite in chat, issue tracker sau capturi de ecran, trateaza-le ca expuse si roteste-le inainte de lansare

## 1. Variabile de mediu

Creeaza `.env.local` pornind de la `.env.example` si completeaza:

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_SANDBOX_SECRET_KEY` optional, pentru checkout-ul contului admin
- `STRIPE_SANDBOX_WEBHOOK_SECRET` optional, pentru webhook-urile checkout-ului admin

Recomandare:

- local: `NEXT_PUBLIC_SITE_URL=http://localhost:3000`
- preview: URL-ul preview real al aplicatiei
- production: URL-ul live real al aplicatiei

Contract recomandat pentru Vercel:

- `Development`: valori locale sau de dezvoltare
- `Preview`: Supabase separat, Stripe Test separat, URL preview real
- `Production`: Supabase separat de Preview, Stripe Live separat, URL live real

Nu te baza pe fallback-uri de platforma pentru `NEXT_PUBLIC_SITE_URL`; trateaza-l ca env obligatoriu in fiecare mediu Vercel.

## 2. Supabase

### Proiect

1. Creezi proiectul Supabase pentru Preview.
2. Creezi proiectul Supabase pentru Production.
3. Copiezi URL-ul proiectului si cheia publishable in env-urile mediului corespunzator.
4. Copiezi service role key doar pe server.

### SQL migrations

Rulezi, in ordine, pentru Preview si apoi pentru Production:

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
34. `supabase/migrations/0033_admin_notification_views.sql`

Pentru fluxul `AI question bank`, migratiile `0013`-`0016` sunt obligatorii.
Migrarea `0017` este recomandata pentru logging OpenAI si audit, dar nu blocheaza procesarea joburilor.

### Auth

In Supabase Auth:

1. setezi `Site URL` la URL-ul aplicatiei pentru mediul respectiv
2. adaugi redirect URLs pentru:
   - `http://localhost:3000/auth/callback`
   - preview URL-urile folosite pentru QA
   - URL-ul de productie + `/auth/callback`

### Google OAuth

In Google Cloud / Google Auth Platform:

1. creezi un OAuth client de tip Web application
2. adaugi origini autorizate:
   - `http://localhost:3000`
   - domeniul de productie
   - URL-ul preview stabil folosit pentru QA, daca nu poti autoriza usor preview-uri arbitrare
3. activezi Google provider in Supabase si completezi Client ID + Client Secret

### Onboarding academic

Dupa primul login, utilizatorul este trimis in `/onboarding` si isi alege comunitatea principala:

- elev sau student
- institutia
- specializarea sau profilul, daca exista
- grupa sau clasa principala

Fara acest pas, AI Workspace si testele private ale comunitatii nu sunt considerate configurate complet.

## 3. Stripe

### API keys

Completezi:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- optional `STRIPE_SANDBOX_SECRET_KEY` pentru contul admin
- optional `STRIPE_SANDBOX_WEBHOOK_SECRET` pentru webhook-ul contului admin

Recomandare:

- `Preview`: chei Stripe Test + webhook secret din endpoint-ul preview
- `Production`: chei Stripe Live + webhook secret din endpoint-ul live
- contul admin poate folosi separat `STRIPE_SANDBOX_SECRET_KEY`, chiar daca restul utilizatorilor folosesc cheia normala a mediului curent

### Webhook endpoint

Endpoint folosit de aplicatie:

- `/api/stripe/webhook`

Evenimentul important pentru fluxul curent:

- `checkout.session.completed`

### Test local

1. pornesti aplicatia local
2. pornesti Stripe CLI
3. forward catre `http://localhost:3000/api/stripe/webhook`
4. copiezi secretul generat de Stripe CLI in `STRIPE_WEBHOOK_SECRET`
5. pentru sesiuni locale rapide poti limita listener-ul la `checkout.session.completed`

## 4. OpenAI

Completezi:

- `OPENAI_API_KEY`

Cheia trebuie sa existe doar server-side. Nu expune aceasta cheie in variabile `NEXT_PUBLIC_*`.

## 5. Storage si AI uploads

Bucket-ul folosit de aplicatie:

- `private-source-documents`

Surse acceptate acum:

- PDF cu text selectabil
- DOCX
- TXT
- text introdus manual

Verificari importante:

- PDF-urile scanate trebuie sa fie respinse
- fisierele peste 30 MB trebuie sa fie respinse
- pe Vercel, pastreaza limita sub pragul platformei pentru request body, altfel uploadul este respins inainte sa ajunga in route handler

## 6. Teste functionale minime

Inainte de productie, verifica:

1. login cu Google
2. logout
3. pornire checkout premium
4. pornire checkout AI credits
5. livrare webhook Stripe
6. actualizare premium in `/cont`
7. actualizare credite AI in `/cont`
8. upload TXT
9. upload DOCX
10. upload PDF cu text selectabil
11. respingere PDF scanat
12. generare draft AI
13. editare draft
14. activare draft
15. rezolvare test privat activ
16. creare materie custom fara dependenta de filesystem local

## 7. Vercel

Vercel trebuie sa foloseasca Node.js `>=22.13.0`, conform `engines.node` din `package.json`. Scriptul `npm run build` ruleaza direct Next.js fara flag-uri Node specifice unei singure instalari locale.

Seteaza toate env-urile atat pentru:

- `Development`
- `Preview`
- `Production`

Recomandare:

- foloseste valori separate unde are sens
- verifica redirect URLs si domeniile preview daca folosesti branch deploys
- dupa orice schimbare de env, redeploy
- valideaza checkout-ul Stripe din preview cu intoarcere in acelasi preview, nu in productie
- prefera un flow `Preview -> Production`, nu publicare directa pe live

## 8. Ordine recomandata de lansare

1. configureaza Supabase Preview
2. ruleaza migratiile `0001`-`0032`
3. configureaza Google OAuth si Auth redirect URLs
4. configureaza Stripe Preview/Test si webhook-ul de preview
5. configureaza OpenAI si bucket-ul `private-source-documents`
6. ruleaza local si testeaza fluxurile minime
7. configureaza env-urile in Vercel pentru `Development`, `Preview` si `Production`
8. testeaza preview deployment
9. configureaza Supabase Production si Stripe Live
10. testeaza din nou pe production dupa promovare
