# Design System

## 1. Rolul documentului

Acest document definește contractul vizual și regulile de implementare pentru interfața `Nota 5+`.

El stabilește:

- rolurile semantice ale tokenurilor;
- straturile sistemului de componente;
- ce poate rămâne global;
- ce trebuie să fie local;
- regulile pentru acțiuni, suprafețe, formulare și navigare;
- procesul de extindere a sistemului.

Foundations, shell-ul global, `app/globals.css` și primitivele canonice din `components/ui/` implementează împreună acest contract, dar nu îl înlocuiesc.

Dacă `app/globals.css` contrazice acest document sau celelalte reguli autoritare din `docs/design/`, contradicția este un defect care trebuie semnalat. Nu transforma automat un selector sau un override existent într-un pattern recomandat.

## 2. Documente asociate

Pentru un task UI, folosește documentele astfel:

- `PRODUCT_UX_PRINCIPLES.md` — ce trebuie să obțină produsul pentru utilizator;
- `PAGE_STRUCTURE_RULES.md` — cum este structurată informația și când se separă în alte containere;
- `RESPONSIVE_RULES.md` — cum se adaptează sarcina pe lățimi diferite;
- `LAYOUT_SPACING_RULES.md` — scara și contractul de spacing;
- `UX_REVIEW_CHECKLIST.md` — verificarea finală;
- acest document — limbajul vizual și arhitectura componentelor.

Nu duplica regulile detaliate din aceste fișiere în componente sau în alte skill-uri.

## 3. Principii vizuale

Interfața trebuie să fie:

- calmă;
- clară;
- academică;
- orientată spre sarcină;
- coerentă între paginile publice și private;
- suficient de expresivă pentru brand, fără decor inutil.

Aspectul „premium” nu justifică:

- carduri pentru fiecare secțiune;
- umbre mari aplicate implicit;
- radius mare pe orice container;
- gradiente decorative;
- iconografie fără rol;
- texte introduse doar pentru echilibru vizual.

Ierarhia și spațiul trebuie să facă cea mai mare parte din munca vizuală.

## 4. Tokenuri de culoare

Folosește tokenurile semantice existente. Nu hardcoda culori în componente dacă există un rol echivalent.

| Rol semantic | Token | Valoare actuală |
| --- | --- | --- |
| Fundal aplicație | `--bg` | `#f5f8fd` |
| Suprafață principală | `--surface` | `#ffffff` |
| Suprafață discretă | `--surface-soft` | `#f7fbff` |
| Text principal | `--ink` | `#14213d` |
| Text secundar | `--muted` | `#60708d` |
| Bordură | `--line` | `#dbe5f2` |
| Acțiune principală | `--primary` | `#1250b1` |
| Hover sau stare activă principală | `--primary-dark` | `#0b367d` |
| Fundal discret pentru accent principal | `--primary-soft` | `#eaf2ff` |
| Succes | `--good` | `#1f9d63` |
| Eroare sau acțiune distructivă | `--bad` | `#b4232c` |

### Utilizare

- `--primary` este rezervat acțiunii principale, stării active și linkurilor importante.
- `--primary-soft` susține selecția sau contextul; nu înlocuiește automat suprafața principală.
- `--bad` este folosit numai pentru eroare, avertizare critică sau acțiune distructivă.
- `--good` este folosit numai pentru succes sau stare pozitivă.
- `--muted` nu trebuie folosit pentru informație esențială sau text cu contrast insuficient.
- Nu introduce o culoare nouă doar pentru diferențiere vizuală. Mai întâi verifică dacă diferența poate fi exprimată prin ierarhie, etichetă, poziție sau formă.
- Nu introduce gradiente decorative noi fără o decizie explicită de extindere a sistemului.

## 5. Tipografie

Interfața folosește fontul sans-serif global existent. Controalele folosesc `font: inherit`.

Pentru formule și conținut matematic se poate folosi tiparul `.math-friendly-input` și fallback-urile deja existente.

Reguli:

- nu introduce fonturi noi fără aprobare;
- textul relevant nu coboară sub `14px`;
- titlurile sunt scurte și descriu sarcina sau rezultatul;
- descrierile sunt mai calme decât titlurile și acțiunile;
- nu folosi greutate mare pentru fiecare label, pill sau text secundar;
- nu crea ierarhie numai prin font-size; folosește și poziție, spațiu și grupare;
- nu introduce paragrafe lungi pentru a explica o interfață care poate fi clarificată prin structură și etichete.

Greutățile și dimensiunile concrete trebuie să provină din tokenurile sau tiparele aprobate ale sistemului, nu din valori locale arbitrare.

## 6. Spacing și layout

Scara, tokenurile și contractul de layout sunt definite în `LAYOUT_SPACING_RULES.md`.

Reguli suplimentare:

- spacing-ul nou folosește tokenuri, nu valori brute;
- containerul paginii controlează gutter-ul exterior;
- părintele controlează distanța dintre secțiuni;
- componenta controlează numai spațiul său intern;
- nu compensa o structură greșită prin margini negative sau override-uri pe copii;
- nu introduce un card doar pentru a obține padding;
- nu introduce lățimi arbitrare pentru a alinia vizual controalele;
- folosește grid, flex, `gap`, `min-width` și `align-items` pentru aliniere.

## 7. Radius, borduri și umbre

Tokenurile existente includ:

- `--radius`;
- `--radius-soft`;
- `--shadow`;
- `--shadow-soft`.

Acestea nu sunt stil implicit pentru orice element.

Reguli:

- folosește radius numai când ajută recunoașterea unei suprafețe sau a unui control;
- nu combina mai multe valori de radius într-o singură compoziție fără motiv;
- bordurile sunt subtile și folosesc tokenurile existente;
- umbrele separă numai suprafețe care trebuie percepute ca nivel distinct;
- conținutul obișnuit nu primește umbră puternică;
- nu folosi simultan fundal, bordură, radius mare și umbră doar pentru a face un bloc să pară important;
- starea activă sau focusul nu trebuie comunicată numai prin umbră.

## 8. Straturile sistemului

Sistemul UI este organizat în cinci straturi.

### 8.1 Foundations

Include:

- tokenuri;
- reset;
- tipografie de bază;
- focus;
- culori;
- spacing;
- breakpoints;
- reguli de accesibilitate.

Acestea pot fi globale.

### 8.2 Primitives

Componente sau clase cu rol semantic mic și stabil, de exemplu:

- acțiune `primary`;
- acțiune `secondary`;
- acțiune `text`;
- acțiune `destructive`;
- input;
- label;
- badge de stare;
- suprafață;
- divider;
- icon button;
- dialog shell.

O primitivă este justificată numai dacă:

- apare în mai multe fluxuri;
- are aceleași stări și aceeași semantică;
- poate fi folosită fără override-uri majore;
- reduce inconsistența reală.

### 8.2.1 Catalogul primitivelor canonice

| Familie | API JSX | CSS | Variante | Utilizare recomandată și baseline migrat |
| --- | --- | --- | --- | --- |
| Acțiuni | `Button`, `ActionLink` din `components/ui/action.js` | `components/ui/action.module.css` | `primary`, `secondary`, `text`, `destructive`; dimensiuni `default`, `compact`, `icon`; `fullWidth` | Pentru butoane și linkuri cu rol de acțiune. Migrarea inițială include erorile globale, 404 și acțiunile formularului testimonial. |
| Câmpuri | `TextField`, `SelectField`, `TextareaField` din `components/ui/form-field.js` | `components/ui/form-field.module.css` | label vizibil, hint, error și control nativ | Pentru controale text-like cu etichetă. Migrarea inițială include câmpurile Number, Date și Select din calculatorul public. Checkbox, radio, file, hidden și controalele speciale rămân native când componenta nu aduce valoare. |
| Status | `StatusPill` din `components/ui/status.js` | `components/ui/status.module.css` | `neutral`, `info`, `success`, `warning`, `danger` | Pentru stări scurte, nu pentru acțiuni. Migrarea inițială include statusurile din `/demo` și `/setup`. |
| Feedback inline | `InlineFeedback` din `components/ui/status.js` | `components/ui/status.module.css` | `error`, `success` | Pentru feedback accesibil asociat unei acțiuni sau unui formular. Eroarea are implicit `role="alert"`, succesul `role="status"`. Migrarea inițială include feedback-ul `GoogleSignInButton`. |
| Suprafețe | `SurfaceCard` din `components/ui/surface-card.js` | `components/ui/surface-card.module.css` | Fără variante vizuale | Pentru un grup autonom care are nevoie de suprafața standard. Nu controlează distanța dintre secțiuni și nu trebuie folosit numai pentru padding. Migrarea inițială include stările structurale de rută. |
| Stări structurale | `EmptyState`, `LoadingState`, `FeedbackState` din `components/ui/state.js` | `components/ui/state.module.css` | Empty `compact`/`section`; feedback `neutral`/`warning`; loading full-page | Pentru absența conținutului sau pentru stări care înlocuiesc structura principală. Migrarea inițială include 404, error boundary, loading-urile comune, lista de materii și testul fără întrebări. |
| Controale de colecție | `FiltersToolbar`, `FilterSearch`, `FilterSelect`, `FilterSortSelect`, `ResultsSummary`, `Pagination` din `components/ui/collection-controls.js` | `components/ui/collection-controls.module.css` | toolbar `two`/`three`/`four`; controale `default`/`compact`; paginare precedent/următor | Pentru căutare, filtrare, sortare, sumar și paginare asociate unei colecții. Migrarea inițială include materiile, dicționarul, articolele, searchurile comune admin/Workspace și paginarea comună. Nu înlocuiește searchurile de navigare, formularele submit sau filtrele specializate. |
| Tabele de date | `DataTable` din `components/ui/data-table.js` | `components/ui/data-table.module.css` | responsive `scroll`/`cards`; aliniere `start`/`center` | Pentru comparație pe rânduri și coloane. Caption-ul este obligatoriu, headerele sunt generate cu `scope="col"`, iar strategia cards cere `data-label` pe fiecare celulă. Celulele, acțiunile, selecția și stările rămân responsabilitatea consumatorului. |

`Button` folosește implicit `type="button"`. Pentru submit, declară explicit `type="submit"`. `ActionLink` cere `href` și acceptă `as` pentru un component de navigare compatibil, inclusiv `PendingNavigationLink`.

`FiltersToolbar` grupează controalele și gestionează numai geometria comună responsive. `FilterSearch` și `FilterSelect` păstrează labelul accesibil, iar selectul gestionează tastatura și restaurarea focusului. `ResultsSummary` nu impune geometrie vizuală. `Pagination` nu se afișează pentru o singură pagină și compune butoanele canonice.

Clasele contextuale pot păstra temporar diferențele admin sau Workspace, dar nu trebuie să depindă de clasele interne ale CSS Module-ului. `DataTable` controlează numai structura, caption-ul, headerele și strategiile responsive finite; acțiunile pe rând, stările și controalele colecției se compun separat.

Consumatorii legacy existenți sunt grandfathered și pot fi migrați incremental. Nu adăuga utilizări noi pentru `.btn-back`, `.btn-link`, `.secondary`, `.test-link`, `.nav-btn`, `.input-search`, `.textarea-input`, `.status-pill`, `.error-state` sau `.success-state`. Nu crea exporturi paralele cu numele API-urilor canonice în alte fișiere.

Același contract se aplică familiilor structurale `.surface`, `.ui-panel-card`, `.draft-card` și `.empty-state`: utilizările existente pot rămâne până la migrarea fluxului lor, dar nu sunt API pentru cod nou. Funcțiile locale `EmptyState` din admin și Workspace sunt compatibilitate internă, nu alternative la componenta canonică.

### 8.3 Patterns

Compoziții reutilizabile pentru o sarcină, de exemplu:

- page header;
- toolbar cu search și filtre;
- empty state;
- list row;
- paginated table;
- segmented tabs;
- confirmation dialog;
- form section.

Patternurile pot compune primitive, dar nu trebuie să conțină logica unei singure pagini.

### 8.4 Page modules

Componente specifice unui flux sau unei pagini:

- workspace upload;
- subject selector;
- test summary;
- account billing panel;
- admin notification table.

Acestea pot reutiliza primitive și patterns, dar nu trebuie mutate în sistemul global doar pentru că sunt vizual mari.

### 8.5 Pages

Paginile orchestrează modulele și responsabilitatea informațională.

O pagină nu trebuie să introducă propriul mini-design-system prin selectori globali, culori noi sau componente duplicate.

## 9. Responsabilitatea CSS

### În stylesheet-urile globale pot rămâne

- tokenurile și foundations în `app/styles/foundations/`;
- shell-ul și navigarea în `app/styles/shell/`;
- stilurile legacy încă folosite în `app/globals.css`;
- patterns globale demonstrate;
- utilitare aprobate;
- reguli de focus și accesibilitate.

### CSS-ul local sau colocat conține

- implementarea izolată a primitivelor canonice prin CSS Modules;
- layout-ul unui singur modul;
- ajustări specifice unei pagini;
- stări care depind de structura locală;
- dimensiuni determinate de conținutul fluxului;
- responsive specific modulului.

### Nu adăuga global

- selectori pentru o singură rută;
- override-uri care repară un component izolat;
- clase legate de numele unei singure pagini;
- valori noi de spacing fără token;
- selectori largi precum `button:hover` care modifică toate rolurile;
- `!important` folosit pentru a câștiga conflicte de specificitate;
- stiluri care presupun că toate cardurile, butoanele sau linkurile au aceeași semantică.

Markerul și verificările automate definite în `LAYOUT_SPACING_RULES.md` trebuie păstrate.

## 10. Acțiuni și butoane

Orice acțiune trebuie clasificată semantic.

### Primary

- reprezintă următorul pas principal;
- este dominantă vizual;
- apare o singură dată în zona principală a paginii;
- are stări `base`, `hover`, `focus-visible`, `active` și `disabled`.

### Secondary

- susține acțiunea principală;
- este vizual mai calmă;
- nu trebuie să moștenească automat hover-ul butonului principal.

### Text action

- este folosită pentru acțiuni discrete, navigare contextuală sau controale inline;
- nu primește fundal de buton plin la hover;
- are focus vizibil și zonă interactivă adecvată.

### Destructive

- este separată vizual de acțiunile normale;
- folosește semantica de eroare;
- cere confirmare când efectul este greu de recuperat.

Reguli:

- nu folosi selectorul global `button` pentru toate variantele;
- nu rezolva diferențele dintre roluri prin override-uri contradictorii;
- nu afișa mai multe acțiuni primare concurente;
- iconul susține eticheta, nu o înlocuiește când sensul nu este evident;
- textul butonului descrie acțiunea, nu o formulare generică precum `Continuă` când contextul nu este clar.

Clasele legacy precum `.btn-primary`, `.btn-link` și `.btn-back` pot rămâne pentru compatibilitate, dar nu sunt automat API-ul canonic pentru orice flux nou.

## 11. Suprafețe și carduri

Cardul este folosit pentru un grup autonom care are cel puțin una dintre proprietățile:

- poate fi scanat sau înțeles separat;
- are stare proprie;
- conține o decizie sau o acțiune proprie;
- trebuie diferențiat clar de conținutul din jur.

Nu folosi cardul:

- pentru fiecare secțiune;
- numai pentru padding;
- numai pentru a umple un grid;
- în interiorul altui card fără o diferență semantică reală;
- ca substitut pentru spațiu, titlu sau divider;
- ca navigare implicită pentru orice funcționalitate.

Un card nu are automat nevoie de CTA, icon, badge, umbră și descriere.

Pentru geometria standard folosește `SurfaceCard`. Părintele rămâne proprietarul distanței dintre carduri sau secțiuni, iar stilurile specifice consumatorului intră în CSS Module-ul acelui consumator. Nu adăuga în `app/globals.css` o clasă nouă de tip card, panel sau surface pentru un singur flux.

## 12. Formulare

- Folosește controale native când sunt suficiente.
- Fiecare control are label vizibil.
- Placeholder-ul nu înlocuiește label-ul.
- Erorile sunt asociate câmpului și explică remedierea.
- Focusul este vizibil.
- Starea disabled rămâne lizibilă și nu este singurul mod de a explica indisponibilitatea.
- Grupează câmpurile după sarcină, nu după structura bazei de date.
- Formularele lungi se împart în pași sau secțiuni numai când există o schimbare reală de sub-sarcină.
- Nu adăuga helper text dacă eticheta și opțiunile sunt deja clare.

## 13. Navigare, taburi și dialoguri

- Extinde un pattern existent numai dacă are aceeași semantică.
- Taburile reprezintă perspective alternative ale aceleiași entități și aceluiași scop.
- Nu folosi taburi pentru funcționalități independente.
- Dialogurile gestionează sarcini scurte și au focus, Escape și închidere clară.
- Drawer-ul păstrează contextul pentru detalii consultative.
- Navigarea globală conține numai destinații importante la nivel de produs.
- Nu pune informație secundară globală în header doar pentru că există spațiu.

## 14. Liste, tabele și stări

- Tabelul este folosit când utilizatorul trebuie să compare rânduri și coloane.
- Lista este folosită când ordinea și scanarea elementelor sunt mai importante decât comparația exactă.
- Cardurile nu înlocuiesc automat un tabel pe mobil.
- Folosește `DataTable` pentru tabele noi și alege explicit `scroll` sau `cards`; varianta cards păstrează ordinea DOM și cere eticheta fiecărei celule prin `data-label`.
- Pentru mobil, definește câmpurile prioritare, detaliul la cerere sau scroll-ul local justificat.
- Loading, empty, error, success și disabled trebuie să păstreze ierarhia paginii.
- Empty state-ul explică ce lipsește și următorul pas posibil, fără copy promoțional.
- Nu adăuga ilustrații sau blocuri mari doar pentru a umple o stare goală.
- Folosește `EmptyState` pentru absența conținutului, `LoadingState` pentru încărcarea structurală de rută și `FeedbackState` pentru un rezultat structural cu heading și acțiuni.
- Pentru mesaje asociate unui formular sau unei acțiuni folosește `InlineFeedback`; nu transforma feedback-ul inline într-un card structural.
- Nu adăuga o variantă `success`, `danger` sau o densitate nouă doar pentru simetrie. Varianta trebuie demonstrată de cel puțin două fluxuri cu aceeași semantică.

## 15. Extinderea sistemului

Înainte de a adăuga un token, o primitivă sau un pattern:

1. identifică problema repetată;
2. verifică dacă există deja un rol semantic echivalent;
3. verifică cel puțin două utilizări reale;
4. definește stările și responsive-ul;
5. documentează motivul;
6. actualizează verificările automate când se aplică;
7. evită migrarea masivă dacă poate fi făcută gradual.

Nu extinde sistemul doar pentru a evita scrierea unei clase locale mici și clare.

## 16. Verificare

Pentru orice schimbare a sistemului vizual:

- rulează `npm run design:check`;
- rulează `npm run ui:check`;
- rulează build-ul;
- verifică stările relevante;
- verifică responsive-ul conform `RESPONSIVE_RULES.md`;
- confirmă că nu au apărut culori, spacing-uri, radius-uri sau umbre neaprobate;
- confirmă că stilul nou nu depinde de `!important` sau de selectori globali largi;
- confirmă că nu ai introdus o componentă globală pentru un singur caz.

## 17. Criteriu de acceptare

O implementare respectă design system-ul când:

- folosește roluri semantice, nu valori arbitrare;
- are o ierarhie clară fără decor excesiv;
- componentele au responsabilitate și scop;
- stilurile globale sunt cu adevărat globale;
- stările și responsive-ul sunt intenționate;
- nu necesită override-uri fragile;
- poate fi extinsă fără a copia CSS sau a inventa un nou mini-sistem.
