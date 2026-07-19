# Distribuirea editorială pe LinkedIn

Integrarea folosește OAuth și API-urile oficiale LinkedIn. Nu folosește browser automation, parole, cookie-uri copiate, scraping sau servicii neoficiale.

## Configurare

În LinkedIn Developer Portal activează `Share on LinkedIn` și `Sign in with LinkedIn using OpenID Connect`. Redirect URI trebuie să fie identic cu `LINKEDIN_REDIRECT_URI`. Conexiunea curentă solicită `openid`, `profile` și `w_member_social`; nu solicită permisiunea de citire a postărilor personale.

Variabilele rămân server-side:

```text
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
LINKEDIN_REDIRECT_URI=https://www.nota5plus.ro/api/admin/linkedin/oauth/callback
LINKEDIN_API_VERSION=202606
LINKEDIN_TOKEN_ENCRYPTION_KEY=
OPENAI_API_KEY=
OPENAI_EDITORIAL_MODEL=gpt-5.6-sol
```

`LINKEDIN_TOKEN_ENCRYPTION_KEY` trebuie să fie o cheie aleatoare de 32 bytes codificată Base64 sau 64 de caractere hexazecimale. Nu reutiliza secretul aplicației drept cheie de criptare.

## Generatorul v2

`lib/linkedin/pipeline.js` orchestrează trei etape cu structured output: strategie, redactare și critică/rescriere. Prompturile modulare sunt în `lib/linkedin/prompts/`, iar regulile editoriale sunt documentate în `LINKEDIN_CONTENT_GUIDELINES.md`.

Adminul oferă aceleași opțiuni pentru generarea manuală și generarea pornită imediat după publicarea articolului:

- scop, tip de postare, ton și audiență;
- CTA, persoană narativă, lungime și poziționarea linkului;
- audiență personalizată, când este selectată explicit.

Setările globale sunt valori implicite și păstrează inclusiv descrierea audienței personalizate. Alegerile făcute la publicarea unui articol se aplică numai acelei variante. Fiecare ediție păstrează configurația, versiunea promptului, analiza, hook-urile, critica, scorul, avertismentele și rafinările.

## Rute

- `GET /api/admin/linkedin/oauth/start` pornește OAuth după verificarea administratorului și rate limit.
- `GET /api/admin/linkedin/oauth/callback` consumă starea OAuth o singură dată și salvează tokenul criptat.
- `PATCH /api/admin/linkedin/settings` salvează modul, modelul, notificările și opțiunile implicite.
- `POST /api/admin/linkedin/articles/[articleId]/generate` creează o ediție nouă.
- `PATCH /api/admin/linkedin/posts/[postId]` salvează editarea manuală și anulează aprobarea veche.
- `POST /api/admin/linkedin/posts/[postId]/actions` aprobă, respinge, publică, reîncearcă, rafinează, salvează feedback sau reia primul comentariu.

Toate rutele verifică sesiunea și rolul de administrator. Tokenul și URN-ul profilului nu sunt acceptate din client.

## Stări și siguranță

Modul implicit necesită aprobare. Sunt disponibile și „Doar ciornă”, „Publică automat” și „Dezactivat”. Publicarea articolului nu este anulată dacă distribuirea eșuează; eroarea și etapa rămân în istoric, iar notificarea Telegram este trimisă separat.

Tokenul este criptat AES-256-GCM. Publicarea revendică atomic înregistrarea. Un rezultat de rețea ambiguu blochează retry-ul pentru a evita duplicatele. Edițiile noi nu rescriu postările deja publicate.

Postarea folosește `POST /rest/posts`. Pentru opțiunea „primul comentariu”, comentariul folosește `POST /rest/socialActions/{postUrn}/comments` numai după confirmarea postării. Starea comentariului este independentă (`pending`, `published`, `failed` sau `unknown`), astfel încât o eroare de comentariu nu produce o a doua postare.

## Persistență

Migrările `20260719080458_linkedin_generator_v2.sql` și `20260719103000_linkedin_default_custom_audience.sql` extind tabelele existente. RLS și accesul exclusiv prin `service_role` rămân neschimbate. Nu sunt create tabele expuse Data API.

## Verificare

```powershell
npm run test:linkedin
npm run agent:check
npm run build
```

Testele mock-uiesc OAuth, Posts API și Comments API. Fixture-urile acoperă zece tipuri de articole. Evaluarea live a generatorului folosește numai fixture-uri sintetice și cheia server-side existentă; nu publică nimic pe LinkedIn.
