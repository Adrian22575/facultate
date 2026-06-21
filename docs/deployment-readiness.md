# Deployment Readiness

Acest ghid descrie ordinea recomandata pentru a porni proiectul local si pentru a-l publica pe Vercel fara pasi lipsa.

Pentru un flux local end-to-end, vezi si `docs/local-end-to-end-setup.md`.

## Stare verificata la 22 iunie 2026

- proiect Vercel: `facultate`, Next.js, Node.js `24.x`;
- domenii atasate: `nota5plus.ro` si `www.nota5plus.ro`;
- ultimul deployment Production verificat este `READY`, dar ruleaza commitul `df0a903` (`Add learning study set foundation`), nu modificarile locale curente;
- Runtime Logs Production nu contin erori sau evenimente fatale in intervalul disponibil de 24 de ore la momentul auditului;
- in Production sunt prezente, ca valori criptate, configurarea Supabase, procesarea materialelor, Stripe, `CRON_SECRET` si notificarile admin;
- lipsesc din Production cele patru variabile `NEXT_PUBLIC_LEGAL_*` enumerate mai jos;
- preflightul raporteaza doar daca o variabila este setata sau lipseste si nu afiseaza fragmente din chei in loguri;
- migratiile Supabase sunt aplicate in Production pana la `0064`; verificarea live confirma schema critica, functiile atomice si bucketul privat;
- rezervarea incarcarilor, reluarea joburilor si lock-urile workerului au teste live concurente;
- workerul cron poate continua in fundal procesarea materialelor, importurilor si seturilor de invatare;
- build-ul local de productie genereaza toate cele 44 de pagini;
- `npm run ui:check` verifica automat JSX-ul activ si ruleaza din `prebuild` inaintea fiecarui build;
- `npm audit --omit=dev` raporteaza 0 vulnerabilitati;
- smoke testul rulat pe Production la 20 iunie 2026 descopera corect redirectul canonic `nota5plus.ro` -> `www.nota5plus.ro` si trece doar 3 din 13 verificari, deoarece deploymentul vechi nu contine inca paginile juridice, headerele noi, protectia actuala a rutelor private si `/api/health`;
- health check-ul curent expune un identificator scurt, non-sensibil, al release-ului, iar smoke testul poate valida explicit commitul cu `--expected-commit`;
- verificarile vizuale nu se ruleaza de rutina la cererea utilizatorului; se folosesc doar daca inspectia codului indica o problema care nu poate fi confirmata headless.

Nu promova workspace-ul curent direct peste Production pana cand datele juridice sunt completate, este creat un Preview din commitul final si fluxurile sensibile sunt validate acolo.

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
- `CRON_SECRET` (Production, minim 24 caractere)
- `NEXT_PUBLIC_LEGAL_OPERATOR_NAME`
- `NEXT_PUBLIC_LEGAL_OPERATOR_ADDRESS`
- `NEXT_PUBLIC_LEGAL_REGISTRATION_ID`
- `NEXT_PUBLIC_LEGAL_CONTACT_EMAIL`
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
35. `supabase/migrations/0034_user_usage_events.sql`
36. `supabase/migrations/0035_licenta_exam_attempts.sql`
37. `supabase/migrations/0036_learning_study_sets.sql`
38. `supabase/migrations/0037_learning_credit_ledger_unique.sql`
39. `supabase/migrations/0038_learning_study_set_idempotency.sql`
40. `supabase/migrations/0039_ai_source_documents_pptx.sql`
41. `supabase/migrations/0040_learning_study_set_reports.sql`
42. `supabase/migrations/0041_learning_study_set_async_jobs.sql`
43. `supabase/migrations/0042_learning_flashcard_reviews_metadata.sql`
44. `supabase/migrations/0043_source_documents_storage_pptx_mime.sql`
45. `supabase/migrations/0044_secure_ai_job_lock_functions.sql`
46. `supabase/migrations/0045_harden_public_functions.sql`
47. `supabase/migrations/0046_restore_profile_rls_policies.sql`
48. `supabase/migrations/0047_atomic_api_rate_limit.sql`
49. `supabase/migrations/0048_scale_indexes_and_rls.sql`
50. `supabase/migrations/0049_redact_usage_event_urls.sql`
51. `supabase/migrations/0050_resilient_stripe_webhook_claims.sql`
52. `supabase/migrations/0051_atomic_ai_credit_consumption.sql`
53. `supabase/migrations/0052_atomic_progress_and_attempts.sql`
54. `supabase/migrations/0053_fix_subject_progress_greatest.sql`
55. `supabase/migrations/0054_atomic_flashcard_reviews.sql`
56. `supabase/migrations/0055_atomic_primary_membership.sql`
57. `supabase/migrations/0056_atomic_stripe_premium_grants.sql`
58. `supabase/migrations/0057_fix_atomic_stripe_premium_grants.sql`
59. `supabase/migrations/0058_atomic_reward_premium_grants.sql`
60. `supabase/migrations/0059_learning_study_set_single_job.sql`
61. `supabase/migrations/0060_import_request_idempotency.sql`
62. `supabase/migrations/0061_atomic_credit_job_enqueue.sql`
63. `supabase/migrations/0062_atomic_credit_job_requeue.sql`
64. `supabase/migrations/0063_import_job_locks.sql`
65. `supabase/migrations/0064_persistent_licenta_mistakes.sql`

Pentru fluxul `AI question bank`, migratiile `0013`-`0016` sunt obligatorii.
Migrarea `0017` este recomandata pentru logging OpenAI si audit, dar nu blocheaza procesarea joburilor.

### Auth

In Supabase Auth:

1. setezi `Site URL` la URL-ul aplicatiei pentru mediul respectiv
2. adaugi redirect URLs pentru:
   - `http://localhost:3000/auth/callback`
   - `http://localhost:3000/auth/reset-password`
   - preview URL-urile folosite pentru QA
   - URL-ul de productie + `/auth/callback`
   - URL-ul de productie + `/auth/reset-password`
3. configurezi un serviciu SMTP propriu pentru emailurile de confirmare si recuperare; serviciul implicit Supabase este potrivit doar pentru testare limitata
4. verifici pe Preview livrarea, linkul de confirmare si resetarea parolei pana la destinatia initiala ceruta de utilizator

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
- PPTX
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
17. upload PPTX
18. procesare materiale, importuri si seturi de invatare dupa inchiderea tabului, prin workerul cron
19. acces la Termeni si Confidentialitate din landing si creare cont
20. stergere cont din `/cont`, inclusiv datele auxiliare si obiectele private din Storage
21. `GET /api/health` raspunde `200` in Preview si Production
22. `npm run ui:check` trece fara dialoguri, imagini, butoane sau linkuri interne invalide
23. `npm run production:smoke -- --base-url https://domeniu-preview.example` trece pe Preview
24. `npm run production:smoke` trece imediat dupa promovarea in Production

Smoke testul verifica inclusiv ca o ruta inexistenta raspunde cu status `404`, afiseaza pagina romaneasca personalizata si include directiva `noindex`.

Pentru uploadurile prin selectorul real de fisier, foloseste acelasi test pe local sau pe deploymentul Preview:

```powershell
npm run learning:ui:file:e2e
npm run learning:ui:file:e2e -- --base-url https://preview.example DOCX PDF PPTX
```

Testul creeaza un utilizator temporar in proiectul Supabase configurat local, incarca fisierele prin browser si curata datele temporare la final. Pentru Preview, variabilele locale trebuie sa indice acelasi proiect Supabase folosit de deploymentul testat.

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
- configureaza `CRON_SECRET` ca variabila sensibila numai in Production
- foloseste un plan care permite cron la fiecare minut pentru `/api/cron/learning-jobs`
- verifica in Vercel ca jobul cron apare dupa deployment si ruleaza cu raspuns `200`
- valideaza checkout-ul Stripe din preview cu intoarcere in acelasi preview, nu in productie
- prefera un flow `Preview -> Production`, nu publicare directa pe live

## 8. Ordine recomandata de lansare

1. configureaza Supabase Preview
2. ruleaza migratiile `0001`-`0064`
3. configureaza Google OAuth si Auth redirect URLs
4. configureaza Stripe Preview/Test si webhook-ul de preview
5. configureaza OpenAI si bucket-ul `private-source-documents`
6. ruleaza local si testeaza fluxurile minime
7. configureaza env-urile in Vercel pentru `Development`, `Preview` si `Production`
8. testeaza preview deployment
9. configureaza Supabase Production si Stripe Live
10. completeaza datele operatorului si obtine validarea juridica pentru Termeni si Confidentialitate
11. configureaza `CRON_SECRET` si verifica workerul programat
12. ruleaza `npm run vercel:preflight` in mediul Production
13. ruleaza `npm run production:smoke -- --base-url URL_PREVIEW --expected-commit SHA_COMMIT` inainte de promovare
14. ruleaza `npm run production:smoke -- --base-url https://nota5plus.ro --expected-commit SHA_COMMIT` imediat dupa promovare; runnerul urmareste redirectul initial si verifica originea canonica

## 9. Securitate si recuperare

- activeaza protectia pentru parole compromise si protectia anti-bot din Supabase Auth;
- confirma ca redirect-urile Auth accepta doar domeniile aplicatiei;
- confirma backup-ul disponibil inainte de lansare;
- urmeaza si testeaza periodic `docs/production-operations-runbook.md` intr-un proiect separat;
- retine ca backup-ul bazei nu restaureaza continutul obiectelor sterse din Storage.
