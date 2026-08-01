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

`app/globals.css` implementează acest contract, dar nu îl înlocuiește.

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

Greutățile și dimensiunile concrete trebuie să provină din tokenurile sau tiparele aprobate din `app/globals.css`, nu din valori locale arbitrare.

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

### În `app/globals.css` pot rămâne

- tokenurile;
- resetul;
- stilurile elementelor de bază;
- shell-ul aplicației;
- primitivele folosite în mai multe fluxuri;
- patterns globale demonstrate;
- utilitare aprobate;
- reguli de focus și accesibilitate.

### CSS-ul local sau colocat conține

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
- Pentru mobil, definește câmpurile prioritare, detaliul la cerere sau scroll-ul local justificat.
- Loading, empty, error, success și disabled trebuie să păstreze ierarhia paginii.
- Empty state-ul explică ce lipsește și următorul pas posibil, fără copy promoțional.
- Nu adăuga ilustrații sau blocuri mari doar pentru a umple o stare goală.

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
