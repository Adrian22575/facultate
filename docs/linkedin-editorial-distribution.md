# Distribuirea articolelor pe profilul personal LinkedIn

Integrarea folosește numai OAuth și API-urile oficiale LinkedIn. Nu folosește browser automation, parole, cookie-uri copiate, scraping sau servicii neoficiale.

## Configurare în LinkedIn Developer Portal

1. Creează sau deschide aplicația LinkedIn asociată produsului.
2. În `Products`, activează **Share on LinkedIn**. Acest produs oferă permisiunea `w_member_social`.
3. Activează **Sign in with LinkedIn using OpenID Connect** pentru `openid` și `profile`.
4. În `Auth`, adaugă redirect URI-ul absolut și identic cu `LINKEDIN_REDIRECT_URI`:
   - producție: `https://www.nota5plus.ro/api/admin/linkedin/oauth/callback`, dacă acesta este domeniul canonic configurat;
   - local: `http://localhost:3000/api/admin/linkedin/oauth/callback`, numai dacă LinkedIn acceptă URI-ul local în aplicația de dezvoltare.
5. Verifică în tabul `Auth` că aplicația are exact scope-urile `openid`, `profile` și `w_member_social`.

Nu solicităm `email`, deoarece nu este necesar pentru publicare. Nu solicităm `r_member_social`; permisiunea este restricționată și fluxul nu citește postările profilului.

## Variabile de mediu

Toate valorile rămân server-side:

```text
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
LINKEDIN_REDIRECT_URI=https://www.nota5plus.ro/api/admin/linkedin/oauth/callback
LINKEDIN_API_VERSION=202606
LINKEDIN_TOKEN_ENCRYPTION_KEY=
OPENAI_EDITORIAL_MODEL=gpt-5.6
```

`LINKEDIN_TOKEN_ENCRYPTION_KEY` trebuie să fie o cheie aleatoare de 32 bytes, codificată Base64, sau 64 de caractere hexazecimale. O poți genera local fără să o salvezi în repository:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Adaugă cheia în Vercel și în mediul local autorizat. Nu reutiliza `LINKEDIN_CLIENT_SECRET` drept cheie de criptare.

## Rute

- `GET /api/admin/linkedin/oauth/start` pornește OAuth după verificarea administratorului și rate limit.
- `GET /api/admin/linkedin/oauth/callback` consumă o singură dată starea OAuth, schimbă codul, citește profilul din `/v2/userinfo` și criptează tokenul.
- `PATCH /api/admin/linkedin/settings` schimbă modul și notificările.
- `POST /api/admin/linkedin/connections/[connectionId]/disconnect` oprește publicarea.
- `POST /api/admin/linkedin/articles/[articleId]/generate` pregătește manual o postare.
- `PATCH /api/admin/linkedin/posts/[postId]` salvează textul editat.
- `POST /api/admin/linkedin/posts/[postId]/actions` aprobă, respinge, publică sau reia o acțiune sigură.

Toate rutele verifică sesiunea și rolul de administrator. Tokenul și member URN-ul nu sunt acceptate din client.

## Moduri

- `Necesită aprobare`, implicit: generează și notifică; administratorul editează, aprobă și publică separat.
- `Doar ciornă`: generează și salvează fără publicare.
- `Publică automat`: publică numai după ce articolul este public, textul trece validarea și conexiunea este validă.
- `Dezactivat`: nu creează distribuiri noi.

Publicarea articolului nu este anulată dacă LinkedIn sau generarea textului eșuează. Distribuirea rămâne în Admin cu starea și eroarea ei.

## Siguranță și duplicate

- Tokenul este criptat cu AES-256-GCM și nu ajunge în browser sau loguri.
- OAuth `state` este aleator, salvat doar ca hash, legat de administrator, expiră după 10 minute și poate fi consumat o singură dată.
- Baza de date impune o singură distribuire pentru perechea articol-profil.
- Publicarea revendică atomic înregistrarea înainte de apelul LinkedIn.
- Un răspuns de rețea ambiguu blochează retry-ul. Administratorul verifică profilul înainte de o nouă încercare, deoarece citirea postărilor personale ar cere `r_member_social`.
- Deconectarea schimbă imediat starea conexiunii, iar toate publicările verifică din nou starea și expirarea înainte de apel.

## API și limitări LinkedIn

Publicarea folosește `POST https://api.linkedin.com/rest/posts`, autor `urn:li:person:{sub}`, `LinkedIn-Version` și `X-Restli-Protocol-Version: 2.0.0`. Postarea curentă este text cu linkul articolului. Imaginea rămâne oprită până când articolele au un asset editorial cu drepturi și URL public verificate.

LinkedIn emite în mod obișnuit access tokenuri cu durată de aproximativ 60 de zile. Refresh tokenurile programatice sunt disponibile numai unor parteneri; aplicația cere reconectarea prin OAuth înainte sau după expirare. Limitele zilnice diferă pe endpoint și se verifică în `Analytics` din Developer Portal.

## Verificare

```powershell
npm run test:linkedin
npm run build
```

Testele folosesc mock-uri pentru OAuth și Posts API. Nu trimit postări reale. Migrarea `20260718143000_linkedin_editorial_distribution.sql` trebuie aplicată înainte de activarea conexiunii.
