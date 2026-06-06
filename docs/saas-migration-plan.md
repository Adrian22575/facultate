# SaaS Migration Plan

Acest proiect va fi migrat incremental, în pași mici, astfel încât aplicația actuală să rămână utilizabilă pe tot parcursul transformării în produs SaaS.

## Pasul 1: Migrare la Next.js App Router

Obiectiv: păstrăm designul și funcționalitățile actuale, dar mutăm aplicația într-o structură modernă Next.js.

Ce intră în acest pas:

- structură `app/` pentru rute și layout global
- componente reutilizabile pentru header, exam, quiz și listarea materiilor
- acces server-side la fișierele JSON existente
- păstrarea stilurilor și a flow-urilor actuale
- compatibilitate pentru URL-urile vechi `.html`
- build validat cu `next build`

Status: implementat

## Pasul 2: Baza SaaS și modelul de date

Obiectiv: introducem infrastructura persistentă și baza pentru autentificare și abonamente.

Ce urmează:

- configurare Supabase proiect
- schemă PostgreSQL pentru profiluri, sesiuni premium, credite AI, teste draft și teste publicate
- politici RLS pentru date private
- variabile de mediu separate pentru chei publice și server-side
- utilitare Next.js pentru clienți Supabase server/client

Status: implementat în cod la nivel de fundație

Livrat în repo:

- `.env.example` pentru cheile publice și server-side
- `lib/supabase/*` pentru browser, server, admin și middleware
- `middleware.js` pentru refresh de sesiune
- `supabase/migrations/0001_saas_foundation.sql` cu tabele, bucket privat și politici RLS
- pagina placeholder `/cont` pentru verificarea integrării de bază

## Pasul 3: Autentificare cu Google

Obiectiv: utilizatorul își poate crea cont și intra în aplicație cu Google OAuth.

Ce urmează:

- Supabase Auth cu Google
- layout cu stare de autentificare
- zone protejate pentru date private
- guard-uri pentru rutele premium și AI

Status: implementare de bază livrată

Livrat în repo:

- pagină de login la `/auth/login`
- pornire OAuth Google din client
- callback server-side la `/auth/callback`
- logout server-side la `/auth/signout`
- rută `/cont` protejată atunci când Supabase este configurat
- stare de autentificare expusă în homepage

## Pasul 4: Plăți și acces premium

Obiectiv: monetizăm accesul la conținut premium și creditele AI.

Ce urmează:

- produse și prețuri Stripe
- Stripe Checkout pentru pachetele cerute
- webhook verificat cu semnătură
- activare premium limitată în timp
- creștere credite AI după plată reușită

Status: implementare de bază livrată

Livrat în repo:

- catalog intern de planuri premium și AI
- pagină `/preturi`
- creare sesiuni Stripe Checkout din backend
- webhook verificat prin semnătură Stripe
- aplicare acces premium și credite AI prin server-side fulfillment
- idempotency pentru webhook events în baza de date

## Pasul 5: Upload documente și storage

Obiectiv: permitem încărcarea surselor acceptate pentru generarea de teste.

Ce urmează:

- Supabase Storage pentru fișiere private
- validare tip MIME și limită de dimensiune
- suport pentru `pdf`, `docx`, `txt` și text introdus manual
- respingere clară pentru PDF scanat sau fără text selectabil

Status: implementare de bază livrată

Livrat în repo:

- AI workspace protejat la `/ai`
- upload privat pentru documente sursă
- validare tip și dimensiune
- suport pentru `pdf`, `docx`, `txt` și text manual
- respingere explicită pentru PDF fără text selectabil

## Pasul 6: Pipeline AI pentru generare teste

Obiectiv: transformăm materialele utilizatorului în întrebări draft sigure și editabile.

Ce urmează:

- extragere text server-side
- prompt OpenAI strict JSON-only
- validare cu Zod
- salvare întrebări ca draft
- consum credit doar după generare și salvare reușită

Status: implementare de bază livrată

Livrat în repo:

- generare server-side prin OpenAI Responses API
- Structured Outputs cu Zod
- salvare draft în baza de date
- consum credit într-o funcție SQL tranzacțională doar după salvare reușită
- review și editare inițială a draft-ului înainte de activare

## Pasul 7: Review, editare și publicare

Obiectiv: utilizatorul poate verifica și corecta întrebările înainte de activare.

Ce urmează:

- editor pentru draft-uri
- confirmare manuală înainte de publicare
- rută pentru testele proprii active
- istoric generări și consum credite

Status: implementare de bază livrată

Livrat în repo:

- editare draft și activare manuală
- rută dedicată pentru testele private active
- pagină separată pentru “testele mele”
- flux mai clar între draft review și test activ

## Pasul 8: Hardening și polish

Obiectiv: închidem riscurile de securitate și pregătim produsul pentru utilizare reală.

Ce urmează:

- audit final RLS
- rate limiting pentru endpoint-uri sensibile
- mesaje clare pentru erori și limite
- observabilitate pentru plăți, AI și upload-uri
- rafinare UX pentru dashboard și onboarding

Status: implementare inițială livrată

Livrat în repo:

- rate limiting server-side pentru AI generate, Stripe checkout și webhook
- feedback mai clar pentru erori de checkout și limite temporare
- UX privat mai clar pentru billing, AI și testele generate

## Pasul 9: Deployment readiness

Obiectiv: transformăm aplicația dintr-un proiect complet în cod într-un sistem clar de configurat și lansat.

Status: implementare de bază livrată

Livrat în repo:

- pagină `/setup` pentru verificarea rapidă a env-urilor
- ghid local `docs/deployment-readiness.md`
- checklist clar pentru Supabase, Google OAuth, Stripe, OpenAI și Vercel
