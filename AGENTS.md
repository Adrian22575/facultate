# AGENTS

## 1. Rolul acestui fișier

Acest fișier este ghidul principal de lucru pentru agenții care modifică repository-ul.

El definește:

- ordinea în care se citește contextul;
- regulile operaționale și de siguranță;
- clasificarea taskurilor;
- limitele de scop;
- verificările obligatorii.

Nu duplică în detaliu design system-ul, regulile UX sau lecțiile de debugging. Pentru acestea folosește documentele autoritare indicate mai jos.

## 2. Contextul produsului

Repository-ul conține aplicația Next.js App Router cunoscută intern ca `Teste Facultate`.

Brandul vizibil pentru utilizator este `Nota 5+`.

Produsul include:

- autentificare Google prin Supabase;
- checkout și webhook Stripe;
- procesare și generare de materiale în backend;
- comunități academice pentru elevi și studenți;
- importuri de seturi pentru licență;
- zone pentru materii, teste, cont și administrare.

## 3. Ordinea de autoritate

Pentru orice task, aplică regulile în această ordine:

1. cerința explicită a utilizatorului;
2. acest fișier, `AGENTS.md`;
3. documentația specifică zonei afectate;
4. skill-ul canonic relevant;
5. implementarea și tiparele existente;
6. presupunerile agentului.

Pentru taskuri UI/UX, citește în această ordine:

1. fișierul canonic `nota5plus-ui-ux-skill.md`;
2. `docs/design/PRODUCT_UX_PRINCIPLES.md`;
3. `docs/design/PAGE_STRUCTURE_RULES.md`;
4. `docs/design/RESPONSIVE_RULES.md`;
5. `docs/design/LAYOUT_SPACING_RULES.md`;
6. `docs/design/DESIGN_SYSTEM.md`;
7. componentele și stilurile fluxului afectat.

Dacă implementarea existentă contrazice documentele autoritare, nu o copia automat.
Păstrează logica de business și corectează numai partea aflată în scopul taskului.

Nu trata mai multe skill-uri UI drept surse paralele. Trebuie să existe un singur skill UI/UX canonic.

## 4. Reguli operaționale obligatorii

- Nu expune niciodată cheile sau valorile din `.env.local` în cod, loguri, capturi sau documentație.
- Nu afișa în interfața utilizatorului termeni precum `AI`, `OpenAI`, `credite AI`, `Supabase`, `Stripe`, `API key`, `webhook`, `database`, `setup` sau `billing`.
- Termenii tehnici pot rămâne în cod, rute interne, loguri administrative și documentația pentru agenți.
- Nu modifica migrații Supabase vechi. Pentru schimbări de schemă, adaugă o migrare nouă în `supabase/migrations/`.
- Nu modifica logica de business, permisiunile, API-urile sau contractele de date într-un task exclusiv vizual, decât dacă utilizatorul cere explicit acest lucru.
- Nu face refactorizări fără legătură cu cerința.
- Nu reorganiza directoare sau nu introduce abstracții globale fără un beneficiu repetat și demonstrabil.
- Nu inventa funcționalități, date, metrici, texte finale sau stări care nu sunt susținute de produs.
- Nu declara un task finalizat dacă verificarea relevantă nu a fost făcută sau dacă există probleme cunoscute neraportate.

## 5. Orientare inițială

Pentru un task obișnuit, citește:

1. `AGENTS.md`;
2. `docs/agent-repo-map.md`;
3. fișierele direct afectate de task.

Citește suplimentar:

- `docs/agent-playbook.md` pentru workflow-uri și comenzi;
- `docs/agent-lessons.md` când taskul atinge o zonă sensibilă, localhost, tabele admin, butoane sau probleme deja întâlnite;
- documentația pluginului relevant când taskul implică Supabase sau OpenAI Developers;
- skill-ul local de mentenanță pentru operațiuni repetitive de repository.

Nu încărca automat directoare mari precum:

- `node_modules/`;
- `.next/`;
- `backup/`;
- loguri;
- capturi de QA.

Inspectează-le numai când taskul o cere.

## 6. Clasificarea taskului

Înainte de a modifica fișiere, clasifică taskul într-unul dintre modurile următoare.

### 6.1 Audit

Exemple:

- analizează pagina;
- identifică problemele;
- compară implementarea cu design system-ul;
- propune priorități.

Reguli:

- nu modifica fișiere;
- nu scrie implementare;
- raportează problemele, impactul și ordinea recomandată;
- separă problemele de UX, UI, responsive și cod.

### 6.2 Arhitectură sau redesign amplu

Exemple:

- reorganizează o pagină aglomerată;
- decide ce trebuie mutat în alte pagini;
- creează un flux nou;
- reconstruiește informația și navigarea.

Reguli:

- inspectează mai întâi produsul și componentele;
- definește scopul, decizia, acțiunea principală și informația necesară;
- produce o structură desktop/mobile înainte de implementare;
- arată ce se elimină, mută sau ascunde;
- nu scrie cod în etapa de propunere dacă utilizatorul a cerut explicit doar analiză, structură sau wireframe.

Dacă utilizatorul cere explicit implementarea completă și cerințele sunt suficient de clare, nu bloca taskul într-un ciclu artificial de aprobare. Prezintă concis structura aleasă și continuă implementarea în același task.

### 6.3 Wireframe

Exemple:

- creează wireframe-ul unei pagini;
- arată layout-ul înainte de cod;
- propune variante de structură.

Reguli:

- nu implementa logica de business;
- nu transforma wireframe-ul în landing page decorativ;
- folosește conținut realist și cantități realiste;
- nu adăuga secțiuni doar pentru a umple spațiul;
- arată desktop și mobil când ambele sunt relevante;
- precizează ce rămâne, ce se mută, ce se ascunde și ce se elimină.

### 6.4 Implementare UI

Exemple:

- implementează pagina aprobată;
- construiește componenta;
- aplică wireframe-ul;
- refă layout-ul după cerințe clare.

Reguli:

- păstrează logica de business;
- implementează numai structura cerută;
- nu adăuga secțiuni sau acțiuni neaprobate;
- reutilizează tokenurile și tiparele potrivite;
- implementează explicit responsive și stările relevante;
- nu copia automat un pattern existent dacă acesta este cauza problemei.
- caută mai întâi primitivele canonice din `components/ui/` pentru acțiuni, câmpuri, statusuri și feedback inline;
- nu adăuga butoane native fără `className` și nu introduce utilizări noi ale claselor legacy `.btn-back`, `.btn-link`, `.secondary`, `.test-link`, `.nav-btn`, `.input-search`, `.textarea-input`, `.status-pill`, `.error-state` sau `.success-state`;
- extinde o primitivă canonică numai când varianta are semantică repetabilă în mai multe fluxuri, nu pentru un singur ecran.
- pentru suprafețe și stări structurale caută mai întâi `SurfaceCard`, `EmptyState`, `LoadingState` și `FeedbackState` din `components/ui/`;
- nu introduce utilizări noi pentru `.surface`, `.ui-panel-card`, `.draft-card` sau `.empty-state` și nu adăuga o geometrie nouă de card, panel sau state în `app/globals.css`;
- pentru colecții folosește `FiltersToolbar`, `FilterSearch`, `FilterSelect`, `FilterSortSelect`, `ResultsSummary` și `Pagination` din `components/ui/collection-controls.js` înainte să creezi controale paralele;
- pentru date comparabile pe coloane folosește `DataTable` din `components/ui/data-table.js`; declară un caption, alege numai strategia `scroll` sau `cards` și păstrează acțiunile și stările în fluxul lor;
- pentru geometria repetată a unui dialog folosește `DialogShell`, dar păstrează portalul și managementul focusului în proprietarul fluxului;
- pentru etichete de secțiune și progres determinist folosește `SectionLabel` și `ProgressBar` din `components/ui/` înainte să recreezi geometria în CSS local;
- nu adăuga în `app/globals.css` geometrie nouă pentru toolbar, filtre, search, sortare, paginare sau tabele; stilurile unui singur flux rămân în CSS Module-ul colocat;
- păstrează CSS-ul unui singur flux în CSS Module-ul colocat și documentează în component map numai patternurile demonstrate de cel puțin două utilizări reale.

### 6.5 Corecție punctuală

Exemple:

- repară spacing-ul;
- aliniază toolbar-ul;
- corectează hover-ul;
- elimină overflow-ul;
- ajustează o coloană de tabel.

Reguli:

- fă cea mai mică modificare robustă;
- nu cere wireframe;
- nu redesena pagina;
- nu crea primitive globale pentru un singur caz;
- verifică exact starea și dimensiunile afectate;
- oprește-te când defectul cerut este rezolvat.

### 6.6 Backend, date sau infrastructură

Reguli:

- citește documentația zonei;
- păstrează compatibilitatea contractelor;
- tratează separat schema, runtime-ul, cache-ul și interfața;
- nu modifica UI-ul în afara feedbackului necesar pentru starea backendului.

## 7. Limitele de scop

Înainte de implementare, identifică:

```text
Fișiere direct afectate:
Componente reutilizate:
Logică de business care trebuie păstrată:
Modificări permise:
Modificări interzise:
Verificări necesare:
```

În timpul taskului:

- nu repara probleme fără legătură doar pentru că le-ai observat;
- notează separat problemele din afara scopului;
- nu înlocui o soluție locală funcțională cu o arhitectură nouă fără motiv;
- nu schimba copy-ul final decât dacă taskul include conținut sau copy;
- nu muta informații între pagini fără o justificare de produs.

## 8. Zone sensibile

### Onboarding și comunități

Când modifici onboarding-ul sau comunitățile, verifică:

- `app/onboarding`;
- `app/auth/callback/route.js`;
- `lib/academic/*`;
- `lib/private-tests.js`.

### Procesare, importuri și review de materiale

Când modifici generarea, procesarea sau importurile, verifică:

- `app/api/ai/generate/route.js`;
- `app/ai/actions.js`;
- `app/api/import/*`;
- `app/api/licenta-import/*`;
- `lib/ai/*`;
- funcțiile SQL relevante din migrații.

### Billing

Când modifici billing-ul, verifică:

- `app/api/stripe/*`;
- `lib/billing.js`;
- `lib/stripe/*`.

### Admin și tabele

Când modifici liste administrative:

- verifică lecțiile existente despre tabele și acțiuni textuale;
- prioritizează scanarea, filtrarea și densitatea;
- nu transforma tabelele în grile de carduri fără un motiv funcțional;
- verifică coloanele lungi, datele, wrapping-ul, înălțimea rândurilor și toolbar-ul.

## 9. Serverul local

Utilizatorul gestionează de regulă serverul local din terminal.

Pentru verificări de rutină:

- nu porni;
- nu opri;
- nu reseta serverul;
- nu șterge `.next`.

Folosește mai întâi:

- build;
- teste headless;
- verificări statice;
- serverul deja pornit, dacă este disponibil.

Poți folosi comenzi care afectează serverul numai când:

- utilizatorul cere explicit;
- problema investigată este chiar runtime-ul local;
- verificarea nu este posibilă altfel;
- explici clar motivul.

Dacă verificarea vizuală nu este posibilă fără pornirea sau resetarea serverului și nu ai permisiunea necesară, nu pretinde că ai făcut QA vizual. Raportează exact ce ai verificat și ce a rămas neverificat.

Pentru probleme recurente de localhost, citește `docs/agent-lessons.md` înainte de intervenție.

## 10. Verificări

Alege verificările în funcție de schimbare, nu le rula mecanic pe toate.

### După schimbări de cod

```powershell
npm run build
```

### După reorganizări de fișiere, documentație sau skill-uri

```powershell
npm run agent:check
```

### După schimbări UI

```powershell
npm run design:check
npm run ui:check
npm run build
```

Dacă serverul este deja disponibil, verifică vizual dimensiunile relevante definite în documentația de design.

### Pentru Supabase

```powershell
npm run supabase:check
npm run supabase:check:live
```

Rulează verificarea live numai când este relevantă și mediul este configurat.

### Pentru OpenAI Developers

```powershell
npm run openai:check
```

### Pentru diagnostic local fără restart

```powershell
npm run dev:doctor
npm run local:probe
npm run server:status
```

### Pentru audit de workspace

```powershell
npm run workspace:audit
```

Nu folosi auditul complet pentru fiecare schimbare mică.

## 11. Verificare UI și responsive

Când taskul include implementare UI și mediul permite verificarea în browser:

1. verifică pagina reală, nu doar build-ul;
2. verifică dimensiunile relevante dintre `1440px`, `1024px`, `768px` și `390px`;
3. verifică:
   - ierarhia;
   - spacing-ul;
   - alinierea;
   - overflow-ul;
   - wrapping-ul;
   - ordinea mobilă;
   - vizibilitatea acțiunii principale;
   - focus-ul;
   - hover-ul;
   - stările empty, loading, error, success și disabled când sunt relevante;
   - conținutul foarte lung;
   - spațiul gol;
4. corectează problemele observate;
5. repetă verificarea după corecții.

Nu marca taskul drept verificat vizual doar pentru că build-ul trece.

## 12. Raportul final

Răspunsul final trebuie să fie proporțional cu taskul.

Pentru implementare, include:

- cauza sau scopul schimbării;
- fișierele modificate;
- modificările principale;
- verificările rulate;
- ce nu a putut fi verificat;
- riscuri sau probleme rămase, dacă există.

Pentru audit, include:

- problemele prioritizate;
- dovezile din cod;
- impactul;
- recomandarea;
- ce informație lipsește pentru o concluzie sigură.

Nu folosi formulări precum „totul este perfect” sau „gata complet” când există limitări de verificare.
