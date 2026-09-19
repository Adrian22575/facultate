# Agenți Codex pentru Nota 5+

Configurație locală verificată la 19 septembrie 2026. Modelul principal ales în aplicație nu este schimbat. Acest document descrie atât intenția configurației, cât și limitele observate; nu este dovada că un anumit rol a rulat.

## Proiectul și motivele organizării

Nota 5+ folosește Next.js 15.5.18 App Router, React 18.3.1 și Node >=22.13.0. `app/` deține pagini, acțiuni server și API-uri; `components/` deține interfața și CSS Modules; `components/ui/` conține primitivele canonice; `lib/` conține logica de produs și integrările. `supabase/migrations/` este sursa pentru schema PostgreSQL, funcții și RLS. `data/` conține fallback-uri locale.

Zonele cu risc sunt autentificarea și onboarding-ul, comunitățile academice, permisiunile admin/RLS, checkout-ul și webhook-urile, contabilizarea consumului, importurile, generarea materialelor și joburile cu locks/idempotency, automatizarea editorială și publicarea LinkedIn. Acestea justifică escaladarea la părinte și review independent, nu câte un agent permanent pentru fiecare integrare.

Validarea folosește `npm run build`, verificările UI/design și suite Node separate pentru tools, dictionary, editorial, LinkedIn și admin. Nu există `npm test` agregat. Scripturile E2E/live pot avea efecte externe și trebuie inspectate înainte de rulare. Deploy-ul este configurat pentru Vercel, cu cron-uri și scripturi de preflight/smoke; nu a fost identificat un workflow `.github` în inspecția efectuată.

## Roluri

| Nume / fișier în `.codex/agents/` | Model | Efort | Sandbox configurat | Responsabilitate și limită |
| --- | --- | --- | --- | --- |
| `repo_explorer.toml` | `gpt-5.6-luna` | `low` | `read-only` | Căutare delimitată, trasee de execuție și ownership CSS; raportează dovezi, fără patch-uri. |
| `quick_fixer.toml` | `gpt-5.6-luna` | `medium` | `workspace-write` | Remediere mică, cu o cauză deja stabilită și fișiere atribuite; fără redesign sau decizii backend sensibile. |
| `implementer.toml` | `gpt-5.6-terra` | `medium` | `workspace-write` | Implementare normală în mai multe fișiere, după clarificarea arhitecturii și a contractelor. |
| `reviewer.toml` | `gpt-5.6-terra` | `high` | `read-only` | Review independent al schimbărilor importante; constată defecte și lipsuri de verificare, fără să le repare. |
| `validator.toml` | `gpt-5.6-luna` | `low` | `workspace-write` | Comenzi existente și reproduceri delimitate; scriere numai pentru artefactele verificării, prin instrucțiune. |

Pentru toate rolurile, escaladarea la părinte este obligatorie când cauza nu poate fi demonstrată, cerințele/arhitectura sunt neclare, soluția depinde de presupuneri, încrederea este mică, scopul crește, subsisteme importante interacționează neașteptat sau verificările eșuează neașteptat. Deciziile despre securitate, date, plăți, concurență, migrări și lifecycle-ul joburilor revin părintelui. Explorer/reviewer pot investiga și identifica riscuri fără să decidă sau să implementeze soluția.

Nu există debugger separat: părintele are deja contextul transversal și gestionează diagnosticul dificil. Nu există agenți separați de UI, plăți și bază de date: implementer citește documentația zonei, iar părintele deține deciziile sensibile. Reviewer folosește efort mare numai când este invocat pentru schimbări importante; nu rulează la fiecare editare.

## Rutare și răspundere

1. Părintele stabilește problema, riscul, rezultatul, limitele fișierelor și criteriile de verificare.
2. Dacă există căutare independentă utilă, deleagă o întrebare precisă către `repo_explorer`.
3. O remediere mică și înțeleasă merge la `quick_fixer`; implementarea normală merge la `implementer`.
4. La incertitudine sau risc, agentul returnează dovezile părintelui. Părintele investighează ori alege explicit o capacitate mai mare disponibilă; nu există rutare automată pe baza unui scor de încredere.
5. `validator` execută verificările coordonate. `reviewer` evaluează independent schimbările importante și dovezile, fără să repete mecanic verificările.
6. Părintele inspectează diff-ul, integrează concluziile și decide dacă obiectivul utilizatorului este îndeplinit.

Modelul implicit pentru subagenții fără model explicit este Luna/medium; acest fallback nu autorizează sarcini dificile. Selectează explicit Terra pentru implementare și review. Fișierul unui rol selectat poate suprascrie modelul/efortul cerut la spawn; pentru escaladare nu presupune că un override ignoră fișierul rolului. Modelul părintelui și setările globale rămân neatinse.

Maximum trei subagenți pot rămâne deschiși simultan. În același checkout, există un singur agent cu sarcini de scriere la un moment dat. Părintele nu editează simultan fișierele atribuite lui. Build-urile și verificările care scriu în `.next` sau ieșiri comune se serializează. Review-ul paralel examinează un diff stabil sau fișiere independente.

În configurația fiecărui copil, `[agents] enabled = false` dezactivează delegarea mai departe; nu dezactivează acel rol în părinte. Părintele are separat `[agents] enabled = true`. Aplicarea acestor valori ca straturi de sesiune a fost verificată prin `config/read`.

Păstrează la părinte: deciziile de produs/arhitectură, ambiguitățile, integrarea rezultatelor, diagnosticul transversal, securitatea și integritatea datelor, migrarea schemelor, efectele externe și decizia finală. Un patch precis rezultat din această analiză poate fi apoi delegat.

Nu folosi agenți pentru o corecție trivială pe care părintele o poate termina imediat, o singură comandă deterministă, o explicație scurtă sau recitirea aceleiași informații. Evită explorări complete duplicate și review-uri repetate fără schimbări noi.

## Permisiuni și limite tehnice

- `read-only` este sandbox-ul cerut pentru explorer și reviewer atunci când runtime-ul aplică fișierul rolului. Nu este o garanție că toate conectoarele externe sunt read-only; instrucțiunile interzic mutațiile externe, iar politica hostului rămâne autoritară.
- `workspace-write` este necesar implementării și verificărilor care generează artefacte. Nu restrânge tehnic scrierea la fișierele atribuite sau, pentru validator, exclusiv la artefacte. Aceste limite și serializarea sunt reguli de orchestrare, nu ACL-uri sau lock-uri.
- Agenții care scriu cer `sandbox_workspace_write.network_access = false`. Nu sunt adăugate directoare cu acces extins, excepții de aprobare sau permisiuni full access. Politica de aprobare este moștenită de la părinte/host.
- Niciun rol nu autorizează deploy, publicare, modificări live, citirea secretelor ori restartul serverului. Pentru operațiuni necesare, părintele revine la scopul autorizat de utilizator și regulile existente.
- Economia de consum este așteptată din Luna pentru căutări/verificări/corecții simple, Terra pentru lucru normal și evitarea moștenirii accidentale a modelului puternic. Nu a fost măsurată o reducere procentuală; contextul inițial și fiecare delegare au cost.

## Compatibilitate observată și activare

- Desktop-ul activ folosește `codex-cli 0.155.0-alpha.9.2`. Comanda `codex` din PATH folosește versiunea distinctă `0.144.6`.
- Formatul standalone `.codex/agents/*.toml` și setările `[agents]` urmează [documentația oficială pentru subagenți](https://learn.chatgpt.com/docs/agent-configuration/subagents). Modelele și eforturile au fost confruntate cu catalogul local actual și cu lista de modele a instrumentului de delegare disponibil în sesiune.
- Desktop `config/read`, executat cu profilul real, a confirmat că repository-ul este trusted și că încarcă `.codex/config.toml`. Nu s-a modificat configurația globală.
- CLI `0.144.6` nu acceptă integral setările noi: `[agents] enabled = false` este interpretat ca un rol și produce `expected struct AgentRoleToml`. Nu folosi acest CLI vechi pentru a valida ori executa această configurație. Folosește versiunea desktop verificată sau actualizează separat CLI-ul și reverifică.
- În sesiunea desktop curentă și într-un test CLI desktop nou, tool-ul `spawn_agent` a expus `model` și `reasoning_effort`, însă nu a expus un selector de rol. Testul nu a putut selecta `repo_explorer` și s-a oprit fără a substitui alt agent. **Rutarea nativă către aceste cinci roluri nu este confirmată funcțional în mediul actual.** Nu există nici endpoint de listare a rolurilor în schema app-server inspectată.
- Configurația salvată nu schimbă retroactiv tool-urile sesiunii curente. Pentru următoarea utilizare, închide și redeschide aplicația Codex și folosește o sesiune nouă în acest proiect. Aceasta este o procedură de reîncărcare, nu o promisiune că selectorul de rol va deveni disponibil. Nu este necesar restartul aplicației Next.js.
- Dacă nici într-o sesiune nouă tool-ul nu permite selectarea rolului, raportează lipsa suportului și păstrează la părinte lucrul care cere acel rol/sandbox. O delegare generică cu model explicit poate avea propriul scop autorizat, dar nu trebuie prezentată ca execuție a unui rol TOML sau ca aplicare a permisiunilor lui. Nu crea taskuri separate drept substitut pentru subagenți.

Un test strict cu profilul global a detectat și cheia preexistentă incompatibilă `computer_use.windows.always_allowed_app_ids`. Testele izolate de setările globale au permis verificarea configurației locale. Nu s-a șters sau schimbat acea setare globală.

## Dovezi de verificare

- Sintaxă TOML: cele șase fișiere au fost parsate cu `tomllib`; numele, căile și câmpurile obligatorii au fost verificate.
- Model/efort: Luna și Terra, cu eforturile declarate, există în catalogul local verificat. Nu au fost inventate modele sau prețuri.
- Chei de sesiune: parserul strict al versiunii desktop a acceptat cheile folosite de configurație și de straturile rolurilor; un control negativ cu o cheie inexistentă a fost respins. Acest test se oprește înainte de inferență.
- Valori de sesiune: app-server desktop a încărcat separat fiecare strat și a returnat modelul, efortul, sandbox-ul și delegarea dezactivată pentru fiecare copil. Aceasta verifică setările, nu descoperirea/selectarea nativă a rolului.
- Smoke test live: selecția rolului indisponibilă, raportată explicit; nu se declară pass pentru delegarea după numele rolului.
- Au fost folosiți efectiv doi subagenți generici cu override explicit: Luna/low pentru inventarierea repository-ului și Terra/high pentru review independent. Aceștia nu au fost porniți prin fișierele de rol nou create.
- Review-ul independent a dus la clarificarea limitelor de sandbox, un singur writer, denumirea sarcinilor de validare și fallback-ul Luna. Dezactivarea delegării în copii este intenționată, iar reviewer rămâne Terra/high doar pentru review-uri importante.
- `npm run agent:check` a fost rulat, dar raportează loguri și `recovery-summary.json` în rădăcină. Logurile existau deja; `recovery-summary.json` a fost generat de diagnosticul UI anterior. Aceste artefacte nu au fost șterse sau mutate pentru a masca rezultatul. Nu este o eroare TOML.
- Nu s-au rulat build sau teste de produs pentru această schimbare exclusiv de configurare/documentație. Nu s-a modificat codul produsului. Modificarea preexistentă din `vercel.json` a rămas neatinsă.

## Cum verifici o delegare într-un task viitor

Poți cere: „Verifică dacă poți selecta rolul repo_explorer; dacă da, deleagă-i doar identificarea fișierelor pentru toolbar-ul admin. Nu modifica nimic. Raportează apelul real, ID-ul agentului, modelul/efortul observabile și dacă sandbox-ul rolului a fost aplicat. Dacă selectorul lipsește, spune asta fără substituire.”

Inspectează apelul de spawn și rezultatul real, apoi lista Active/Done a subagenților dacă interfața o oferă. Numele prietenos al unui agent nu dovedește rolul, modelul sau permisiunile. Cere dovezi din metadatele runtime; când nu sunt expuse, valoarea trebuie declarată neverificată. Un răspuns al agentului care repetă modelul din TOML nu este dovadă independentă.

Într-un client care suportă rolurile, verifică un task fără efecte externe și confirmă separat: rolul selectat, modelul, efortul, sandbox-ul și absența modificărilor de fișiere. Abia apoi considera rutarea prin fișierele de rol activă. Referință suplimentară: [configurația Codex](https://learn.chatgpt.com/docs/config-file/config-reference).
