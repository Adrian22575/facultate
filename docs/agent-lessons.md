# Agent Lessons

Acest fisier este pentru greseli, incidente si reguli practice pe care agentul nu trebuie sa le repete in repo-ul asta.

## Greseli deja intalnite

### 1. Nu presupune ca migratiile Supabase sunt aplicate

Ce s-a intamplat:
- paginile private au cazut pentru ca aplicatia a inceput sa citeasca `profiles.user_type` si tabelele academice inainte ca migrarea `0005` sa fie aplicata complet.

Regula:
- orice logica noua care depinde de coloane sau tabele SaaS trebuie sa trateze lipsa lor ca `setup incomplet`, nu ca eroare fatala.

### 2. Nu declara localhost reparat fara verificare de asset-uri

Ce s-a intamplat:
- HTML-ul raspundea cu `200`, dar CSS-ul si chunk-urile din `/_next/static/...` inca raspundeau cu `404`, deci pagina parea alba sau neformatata.

Regula:
- dupa un restart `next dev`, verifica mereu:
- pagina principala
- un asset CSS din `/_next/static/css/...`
- un chunk JS din `/_next/static/chunks/...`

### 3. Next.js dev pe Windows poate corupe cache-ul webpack

Ce s-a intamplat:
- a aparut `Cannot find module './948.js'` din `.next/server/webpack-runtime.js`.

Regula:
- cand apar chunk-uri lipsa in dev:
- opreste procesul care asculta pe `3000`
- sterge `.next`
- reporneste `next dev`
- evita sa lasi cache persistent daca problema reapare

### 4. Verifica portul real dupa restart

Ce s-a intamplat:
- o instanta veche tinea `3000`, iar noul dev server a pornit pe `3001`.

Regula:
- dupa restart, confirma explicit portul si nu presupune ca aplicatia a revenit pe `3000`.

### 5. Nu te baza pe build ca substitut pentru dev runtime

Ce s-a intamplat:
- `next build` putea trece, dar `next dev` tot avea probleme de cache sau spawn.

Regula:
- pentru bug-uri locale, valideaza separat:
- `build`
- `dev`
- rutele afectate in browser

### 6. Verifica redirectul real al rutei `/`

Ce s-a intamplat:
- fisierele locale pentru landing page fusesera schimbate, dar `localhost:3000` continua sa raspunda cu un redirect vechi.

Regula:
- dupa orice schimbare de routing sau landing page, verifica raspunsul real de la `/`
- nu presupune ca dev serverul serveste ultima versiune doar pentru ca fisierele au fost salvate
- daca redirectul nu corespunde codului actual, reporneste serverul si curata `.next`

### 7. Nu pune `cache()` peste date locale care se modifica din UI

Ce s-a intamplat:
- lista de materii este citita din fisiere JSON locale, iar cand utilizatorul adauga o materie din interfata trebuie sa o vada imediat.

Regula:
- daca datele sunt mutate din produs in timpul sesiunii, evita `cache()` pe citirea lor sau invalideaza explicit sursa
- pentru flow-uri de tip `adauga si selecteaza`, actualizeaza si starea client-side imediat dupa raspunsul serverului

### 8. `Materia` nu este acelasi lucru cu `anul` sau `semestrul`

Ce s-a intamplat:
- UX-ul a devenit confuz cand materia a fost modelata direct ca `materie + an + semestru`, ceea ce crea dubluri si facea popup-ul de adaugare sa para gresit.

Regula:
- trateaza materia ca entitate globala
- anul, semestrul si clasa descriu contextul in care materia este folosita
- filtrele si generarea aleg contextul separat de identitatea materiei

### 9. Catalogul de materii trebuie sa fie persistent real

Ce s-a intamplat:
- materiile noi se salvau doar in fisiere JSON locale, ceea ce era bun pentru prototip, dar nu pentru produsul real.

Regula:
- cand o entitate este comuna pentru tot produsul, mut-o in Supabase
- pastreaza fallback local doar pentru `setup incomplet`, nu ca sursa principala pe termen lung
- daca pastrezi fallback, nu schimba contractul public al functiilor care citesc sau scriu datele

### 10. Nu prinde `redirect()` in `catch` fara sa re-arunci `NEXT_REDIRECT`

Ce s-a intamplat:
- in server actions de onboarding, insertul putea reusi, dar `redirect()` arunca intern `NEXT_REDIRECT`
- acel `redirect` a fost prins de `catch` ca si cum ar fi eroare reala, iar flow-ul de dupa salvare parea stricat sau ramanea pe acelasi pas

Regula:
- daca un `redirect()` este intr-un bloc `try`, trateaza separat erorile Next de redirect
- foloseste `isRedirectError(error)` si re-arunca imediat
- abia dupa asta map-eaza erorile reale spre mesaje pentru utilizator

### 11. In repo-ul asta, localhost ruleaza frecvent pe `next start`, nu pe hot reload

Ce s-a intamplat:
- utilizatorul continua sa nu vada modificarile in browser dupa editari valide
- cauza recurenta a fost ca serverul local rula pe build de productie (`next start`), deci fisierele noi nu apareau pana la rebuild + restart

Regula:
- dupa orice schimbare UI importanta, nu presupune ca refresh-ul simplu e suficient
- daca utilizatorul spune ca nu vede modificarile, trateaza asta implicit ca `build/restart necesar`
- in acest repo, cand localhost nu reflecta codul nou:
- ruleaza `npm run build`
- opreste procesul care asculta pe `3000`
- reporneste cu `npm run start`
- abia dupa asta spune utilizatorului sa dea refresh

### 12. Butoanele secundare au nevoie mereu de hover explicit

Ce s-a intamplat:
- butoane precum `Logout` sau `Inchide` au ajuns sa mosteneasca stiluri de baza corecte, dar fara stare de hover explicita
- in unele ecrane, alte reguli CSS au facut textul greu de vazut la hover

Regula:
- pentru orice buton secundar reutilizat in header, modal sau sheet, defineste explicit:
- `background`
- `border-color`
- `color`
- `focus-visible`
- nu te baza doar pe clasa generica sau pe stilul mostenit dintr-un alt context
- daca un buton apare in doua zone diferite, prefera o clasa dedicata de context in loc de override-uri implicite

### 13. Tabelele admin dense trebuie validate semantic, nu doar functional

Ce s-a intamplat:
- tabelele din Admin Center au ramas functionale, dar coloanele lungi (`Nume`, `Institutie`) si cele scurte de data (`Creat la`) au produs randuri prea inalte, search lipit vizual de taburi si mult scroll inutil

Regula:
- inainte sa spui ca un tabel admin este gata, verifica explicit:
- daca un nume lung forteaza randuri exagerat de inalte
- daca data sau ora se rupe pe doua randuri fara motiv
- daca toolbar-ul are taburi si search bine aliniate, cu suficient aer
- daca un al doilea tabel sau subtab nu este impins prea jos doar din cauza layout-ului
- daca titlul tabelului si subtitlul stau intr-un card separat inutil, desi exista deja un card principal pentru sectiune
- daca apar campuri lungi, solutia preferata este:
- largirea semantica a coloanei
- compactarea randului
- separarea in subtaburi sau sectiuni
- simplificarea compozitiei vizuale, astfel incat sa nu existe carduri mari imbricate fara nevoie
- nu accepta ca solutie finala doar mai mult scroll si randuri groase
- pentru date administrative mari, tabelul este patternul implicit; evita carduri cu alte carduri in interior

### 14. Nu lasa `button:hover` sa decida hover-ul pentru actiuni textuale

Ce s-a intamplat:
- un element textual clickable din tabel (`admin-table-link`) a mostenit hover global de buton primar si a afisat o bula albastra peste text

Regula:
- daca un element este semantic `button`, dar vizual este `text action`, nu-l lasa sa intre in selectorii globali pentru butoane pline
- pentru astfel de elemente defineste explicit:
- stare normala
- hover
- focus-visible
- combinatie cu hover-ul randului de tabel
- valideaza mereu hover-ul pe elemente inline din tabele, nu doar pe CTA-uri reale

### 15. Butoanele albastre trebuie verificate pe toate starile, nu doar in stare normala

Ce s-a intamplat:
- reguli globale prea largi pe `button` + override-uri locale cu `!important` au produs contraste gresite
- `Logout` si `Inchide` au avut combinatii de text inchis pe fundal albastru la hover/focus

Regula:
- separa semantic butoanele in `primary`, `secondary`, `text action`
- nu lasa selectorul global `button` sa stilizeze butoane secondary sau close buttons
- pentru `primary`, valideaza obligatoriu:
- `base`
- `hover`
- `focus-visible`
- `disabled`
- pentru butoanele critice (`Logout`, `Inchide`, CTA-uri principale), evita override-uri contradictorii cu `!important` care schimba culoarea textului

### 16. Dupa schimbari mari in App Router, valideaza cu reset complet de dev cache

Ce s-a intamplat:
- dupa schimbari in pagini server-side, loaders si Supabase imports, `next dev` a ramas cu artefacte corupte in `.next`
- refresh-ul a inceput sa ceara chunk-uri inexistente precum `./1633.js` sau `./vendor-chunks/@supabase.js`

Regula:
- in repo-ul asta, dupa schimbari mari de App Router sau server components, nu valida doar prin hot reload
- ruleaza secventa completa:
- opreste procesele `node`
- sterge `.next`
- reporneste dev server-ul cu `cmd /c npm run dev`
- pentru repetare usoara, foloseste scriptul local `npm run dev:reset`
- dupa restart, verifica refresh real pe:
- `/`
- `/ai`
- o ruta dinamica din `materii`

### 17. In AI Workspace, submit-ul poate reusi iar ruta jobului sa cada ulterior din cauza `.next`

Ce s-a intamplat:
- `POST /api/ai/generate` a raspuns cu `303`, deci upload-ul si crearea jobului au mers
- eroarea reala a aparut abia la `GET /ai/jobs/[jobId]`
- in log au aparut `Cannot find module './vendor-chunks/@supabase.js'`, `webpack-runtime.js` si apoi `/_next/static/... 404`

Regula:
- nu interpreta automat o eroare dupa submit ca bug in pipeline-ul de upload text sau in Supabase
- separa clar:
- `POST` a reusit sau nu
- ruta dinamica de job se compileaza sau nu
- daca vezi `vendor-chunks`, `MODULE_NOT_FOUND`, `__webpack_modules__[moduleId] is not a function` sau `/_next/static/... 404`, trateaza cazul ca dev runtime corupt
- pentru schimbari in `/ai`, checklist-ul minim devine:
- `/ai`
- submit real
- `/ai/jobs/[jobId]`
- asset-urile `/_next/static/...`
- daca `next dev` continua sa corupa `.next` dupa ruta jobului, valideaza flow-ul cu `npm run start:reset`

### 18. Pe Windows, fetch catre Supabase poate pica fara certificatele sistemului

Ce s-a intamplat:
- rutele locale au raspuns cu `500`, iar logul arata `UNABLE_TO_VERIFY_LEAF_SIGNATURE`
- cauza a fost fetch-ul Node catre Supabase prin certificatul local/proxy, nu pagina React in sine

Regula:
- scripturile care pornesc Next sau fac verificari live trebuie sa ruleze Node cu `--use-system-ca`
- dupa schimbarea scripturilor, serverul deja pornit trebuie repornit ca sa preia flagul nou
- pentru verificare rapida, ruleaza direct `node --use-system-ca scripts/learning-monitor.mjs` sau `node --use-system-ca scripts/supabase-check.mjs --live`

## Checklist scurt inainte de a spune gata

- `localhost:3000` raspunde
- `/auth/login` raspunde
- CSS din `/_next/static/...` raspunde cu `200`
- nu exista `500` noi in `dev-server.err.log`
- daca s-a schimbat schema, documentatia si setup-ul au fost actualizate
