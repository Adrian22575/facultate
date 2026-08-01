# Layout and Spacing Rules

## 1. Rolul documentului

Acest document definește contractul de layout și spacing pentru interfața `Nota 5+`.

El stabilește:

- scara de spacing;
- cine deține fiecare tip de spațiu;
- cum se construiesc shell-urile, secțiunile, cardurile și controalele;
- cum se tratează desktopul și mobilul;
- ce excepții sunt permise;
- ce verificări sunt obligatorii.

Pentru arhitectura informației folosește `PAGE_STRUCTURE_RULES.md`.
Pentru culori, componente și CSS global folosește `DESIGN_SYSTEM.md`.
Pentru comportamentul pe breakpoint-uri folosește `RESPONSIVE_RULES.md`.

## 2. Principiul de bază

Spațiul exprimă ierarhia.

Nu folosi spacing-ul ca remediu local pentru:

- o structură greșită;
- un container nepotrivit;
- un element prea lat;
- o aliniere incorectă;
- un card introdus fără nevoie;
- un breakpoint lipsă;
- un text prea lung.

Înainte de a adăuga sau modifica spacing, identifică:

1. ce relație trebuie exprimată;
2. ce element deține relația;
3. ce token corespunde;
4. dacă problema este de fapt structurală.

## 3. Scara obligatorie

Pentru spacing nou se folosesc numai tokenurile definite în `app/globals.css`.

| Token | Valoare | Rol principal |
| --- | ---: | --- |
| `--space-0` | `0` | eliminarea explicită a spațiului |
| `--space-1` | `4px` | relație foarte strânsă |
| `--space-2` | `8px` | elemente din același control |
| `--space-3` | `12px` | grup compact |
| `--space-4` | `16px` | grup de conținut sau padding compact |
| `--space-5` | `24px` | secțiune normală sau padding standard |
| `--space-6` | `32px` | separare majoră sau gutter desktop |
| `--space-7` | `48px` | separare amplă sau final de pagină |
| `--space-8` | `64px` | tranziție intenționată între zone distincte |

Nu introduce valori brute precum:

- `6px`;
- `10px`;
- `18px`;
- `20px`;
- `22px`;
- `28px`;
- `36px`;
- `40px`;
- `56px`.

Excepția este permisă numai dacă:

- problema nu poate fi rezolvată cu scara existentă;
- valoarea reprezintă un pattern repetat;
- design system-ul este extins cu un token semantic;
- motivul este documentat;
- verificările automate sunt actualizate când se aplică.

## 4. Ownership-ul spațiului

Fiecare relație de spacing are un singur proprietar.

### 4.1 Shell-ul paginii deține

- gutter-ul exterior;
- lățimea maximă;
- centrarea;
- spațiul de început și final al paginii.

### 4.2 Layout-ul secțiunilor deține

- distanța dintre secțiuni;
- ordinea verticală;
- coloanele principale;
- schimbarea structurii pe breakpoint-uri.

### 4.3 Cardul sau panoul deține

- padding-ul intern;
- distanța dintre header-ul intern și conținut;
- separarea dintre grupurile interne.

### 4.4 Toolbar-ul deține

- distanța dintre search, filtre, sortare și acțiuni;
- wrapping-ul;
- alinierea;
- ordinea pe mobil.

### 4.5 Controlul deține

- padding-ul intern;
- distanța dintre icon și text;
- distanța dintre label și valoare internă.

### 4.6 Copilul nu trebuie să dețină

- distanța față de secțiunea precedentă;
- compensarea padding-ului părintelui;
- alinierea întregului layout;
- gutter-ul paginii.

Nu folosi `margin-top` pe fiecare copil pentru a simula un layout.
Preferă `display: grid` sau `flex` cu `gap`.

## 5. Contractul principal

Structura implicită este:

```text
viewport
  └─ app shell
       └─ page container
            └─ page sections
                 └─ panel/card când este justificat
                      └─ content groups
                           └─ controls
```

Relațiile implicite sunt:

```text
page gutter:
  --page-gutter

section gap:
  --layout-section-gap

card padding:
  --layout-card-padding

compact card padding:
  --layout-card-padding-compact

content group gap:
  --space-4

control group gap:
  --space-2 sau --space-3
```

Nu adăuga straturi doar pentru a obține spațiu.

## 6. Gutter și container

- Un singur container principal de pagină stabilește gutter-ul exterior.
- Componentele din interior nu repetă padding-ul de pagină.
- Secțiunile full-width sunt permise numai când există un motiv funcțional sau vizual clar.
- Nu folosi margini negative pentru a ieși din container.
- Nu introduce `width: calc(...)` doar pentru a compensa padding-uri greșite.
- Nu lărgi pagina pentru a rezolva un toolbar sau un tabel prost structurat.
- Lățimea maximă trebuie să provină din shell sau dintr-un token aprobat.

## 7. Secțiuni

O secțiune reprezintă o schimbare reală de sarcină sau de conținut.

Reguli:

- distanța dintre secțiuni este deținută de părintele paginii;
- secțiunile consecutive folosesc aceeași logică de gap;
- nu introduce spațiu suplimentar doar pentru a face o zonă să pară importantă;
- nu folosi separator mare înainte și după fiecare titlu;
- titlul secțiunii stă mai aproape de conținutul său decât de secțiunea precedentă;
- dacă două blocuri trebuie percepute ca un singur flux, micșorează diferența dintre ele și elimină containerele inutile;
- dacă două blocuri sunt sarcini diferite, separarea trebuie să fie structurală, nu doar o margine mai mare.

## 8. Carduri și panouri

Cardurile folosesc padding intern din tokenurile aprobate.

Reguli:

- un card cu fundal și bordură trebuie să aibă padding explicit;
- nu crea card fără padding doar pentru a obține o bordură;
- nu pune un card în alt card fără diferență semantică;
- nu folosi un card ca spacer;
- nu compensa un card prea îngust prin margini negative;
- titlul cardului și conținutul folosesc o relație internă stabilă;
- acțiunile din card trebuie să aibă aliniere și gap intenționat;
- pe mobil, cardul poate folosi padding compact, dar nu reduce lizibilitatea sau targeturile tactile.

Un container nu devine card doar pentru că are `background`, `border`, `radius` sau `shadow`.
Cardul trebuie să reprezinte un grup autonom.

## 9. Header-ul paginii

Header-ul paginii poate conține:

- titlu;
- descriere scurtă;
- stare contextuală;
- acțiunea principală;
- maximum două acțiuni secundare.

Reguli:

- titlul, descrierea și acțiunile trebuie să formeze un singur grup coerent;
- nu separa acțiunile prin spații arbitrare;
- pe desktop, folosește grid sau flex pentru titlu și acțiuni;
- pe mobil, ordinea trebuie să rămână clară și acțiunea principală vizibilă;
- nu adăuga padding asimetric pentru a alinia vizual header-ul cu un alt bloc;
- nu introduce un card separat doar pentru header dacă pagina are deja un shell clar.

## 10. Toolbar-uri

Toolbar-ul grupează controale care modifică același set de rezultate.

Reguli:

- search, filtrele și sortarea stau aproape de rezultatele afectate;
- folosește `gap`, nu margini individuale;
- controalele cu aceeași importanță au înălțimi coerente;
- nu întinde automat toate controalele pe toată lățimea;
- search-ul poate primi lățime flexibilă sau limitată, în funcție de context;
- filtrele rare pot fi mutate într-un control compact;
- acțiunea principală nu trebuie pierdută într-un rând de filtre;
- când toolbar-ul nu încape, schimbă structura, nu pagina.

Nu introduce panou gol între toolbar și rezultate.

## 11. Liste și tabele

- Lista începe imediat după toolbar-ul care o controlează.
- Nu adăuga margine suplimentară peste gap-ul deja deținut de layout.
- Rândurile folosesc padding coerent și suficient pentru scanare.
- Textele lungi nu trebuie să producă înălțimi de rând necontrolate fără o strategie.
- Tabelele nu trebuie împinse în jos de summary cards sau containere decorative.
- Wrapper-ele de tabel nu primesc padding suplimentar dacă tabelul este deja într-un card.
- Header-ul tabelului, toolbar-ul și rezultatele trebuie să pară aceeași compoziție.

## 12. Formulare

- Label-ul și controlul folosesc o relație strânsă.
- Grupurile de câmpuri folosesc spacing mai mare decât relația label-control.
- Secțiunile formularului folosesc spacing de secțiune, nu margini locale.
- Erorile apar aproape de controlul afectat.
- Helper text-ul apare mai aproape de control decât de următorul câmp.
- Acțiunile formularului sunt separate clar de câmpuri, fără goluri arbitrare.
- Pe mobil, nu micșora înălțimea controalelor pentru a reduce lungimea paginii.

## 13. Aliniere

Pentru aliniere folosește:

- `display: grid`;
- `display: flex`;
- `gap`;
- `align-items`;
- `justify-content`;
- `min-width`;
- `max-width`;
- coloane semantice.

Nu folosi:

- padding asimetric;
- margini negative;
- `transform: translate(...)`;
- valori arbitrare de `left` sau `top`;
- spații introduse în text;
- elemente goale;
- pseudo-elemente decorative folosite ca spacer.

Dacă două elemente nu se aliniază, verifică mai întâi:

1. dacă au același părinte;
2. dacă părintele are aceeași coloană;
3. dacă există padding duplicat;
4. dacă un element are lățime implicită diferită;
5. dacă problema este de conținut sau wrapping.

## 14. Spațiul gol

Spațiul gol este intenționat când:

- separă sarcini;
- protejează ierarhia;
- reduce densitatea cognitivă;
- păstrează acțiunea principală vizibilă;
- permite scanarea.

Spațiul gol nu trebuie umplut automat cu:

- carduri;
- metrici;
- texte de ajutor;
- iconuri;
- ilustrații;
- CTA-uri secundare;
- recomandări inventate.

Totuși, un gol mare poate indica:

- padding duplicat;
- secțiune goală;
- container cu `min-height`;
- margin collapse;
- element ascuns care încă ocupă spațiu;
- structură desktop păstrată pe mobil.

Înainte de a păstra un gol mare, identifică sursa și rolul lui.

## 15. Desktop

Pe desktop:

- gutter-ul exterior poate fi mai generos;
- coloanele sunt folosite numai când informația trebuie văzută simultan;
- nu lărgi conținutul text doar pentru a ocupa ecranul;
- nu crea coloană secundară doar pentru echilibru;
- nu distribui controalele pe toată lățimea dacă relația lor devine neclară;
- păstrează o axă vizuală stabilă între header, toolbar și conținut.

## 16. Mobile

Sub breakpoint-ul mobil definit în sistem:

- gutter-ul exterior se reduce înaintea spacing-ului intern al controalelor;
- coloanele se stivuiesc;
- ordinea conținutului se prioritizează;
- targeturile interactive rămân de minimum `44px`;
- nu există scroll orizontal la nivelul paginii;
- toolbar-urile se împart în rânduri sau devin compacte;
- taburile folosesc wrapping, prioritizare, meniu sau scroll local controlat;
- acțiunea principală nu este împinsă după conținut secundar;
- cardurile folosesc padding compact numai când este necesar.

Nu rezolva mobile prin:

- font mai mic;
- butoane mai mici;
- gap-uri aproape inexistente;
- păstrarea forțată a coloanelor;
- lărgirea viewport-ului;
- ascunderea acțiunilor necesare.

## 17. Breakpoint-uri

- Folosește breakpoint-urile existente ale proiectului.
- Nu introduce breakpoint pentru o singură valoare de padding sau o singură componentă fără motiv.
- Un breakpoint este justificat când se schimbă structura, nu doar când „arată puțin mai bine”.
- Dacă mai multe componente au nevoie de același breakpoint nou, extinde sistemul și documentează motivul.
- Evită intervale fragile în care layout-ul funcționează numai la dimensiunile testate.

## 18. Excepții

O abatere de la reguli trebuie să fie:

- necesară;
- locală;
- documentată;
- testată;
- compatibilă cu responsive-ul;
- fără efecte globale neintenționate.

Exemple posibile:

- control matematic cu cerințe tipografice speciale;
- tabel cu scroll local justificat;
- vizualizare care are nevoie de full-width;
- element media cu aspect ratio fix.

O excepție nu justifică:

- valori brute de spacing;
- selector global nou;
- `!important`;
- margini negative;
- duplicarea unui shell;
- crearea unui token pentru o singură situație accidentală.

## 19. Verificare automată

Pentru schimbări de layout sau spacing rulează:

```powershell
npm run design:check
npm run ui:check
npm run build
```

`design:check` trebuie să verifice:

- folosirea tokenurilor;
- contractul shell-ului;
- CSS-ul adăugat după markerul de protecție;
- valorile brute de `margin`, `padding` și `gap`;
- regulile globale periculoase când sunt acoperite de verificare.

Fiecare stylesheet global importat de `app/layout.js` trebuie să conțină exact un marker `DESIGN-SPACING-GUARD`.

În arhitectura incrementală actuală, verificarea acoperă:

- `app/styles/foundations/tokens.css`;
- `app/styles/foundations/reset.css`;
- `app/styles/foundations/accessibility.css`;
- `app/globals.css`.

CSS-ul existent deasupra markerului reprezintă baseline-ul acceptat. Orice reguli adăugate după marker sunt verificate pentru valori brute de `margin`, `padding` și `gap`.

Nu muta, duplica sau șterge markerii fără actualizarea verificărilor și nu schimba ordinea importurilor foundations → legacy din `app/layout.js`.

## 20. Verificare vizuală

Când mediul este disponibil, verifică la:

- `1440px`;
- `1024px`;
- `768px`;
- `390px`.

Compară explicit:

- viewport → page gutter;
- topbar → page header;
- titlu → descriere;
- header → primul control;
- toolbar → rezultate;
- card → conținut;
- label → control;
- control → eroare sau helper text;
- secțiune → secțiune;
- finalul conținutului → finalul paginii.

Verifică și:

- alinierea axelor;
- wrapping-ul;
- overflow-ul;
- targeturile tactile;
- spațiul gol;
- stările loading, empty și error;
- conținutul foarte lung.

Dacă observi un spațiu greșit, identifică proprietarul înainte de a modifica CSS-ul.

## 21. Anti-pattern-uri

Evită:

- `margin-top` adăugat pe fiecare componentă;
- padding duplicat între shell și pagină;
- card folosit ca spacer;
- margini negative;
- aliniere prin valori arbitrare;
- multiple wrapper-e fără rol;
- desktop rezolvat prin lățimi fixe;
- mobile rezolvat prin micșorarea controalelor;
- `gap` diferit pentru fiecare instanță a aceluiași pattern;
- spacing mare introdus doar pentru aspect „premium”;
- spațiu gol umplut cu elemente decorative;
- override-uri locale peste reguli globale greșite în locul corectării sursei.

## 22. Criterii de acceptare

Layout-ul respectă sistemul când:

- fiecare spațiu are un proprietar clar;
- tokenurile sunt folosite consecvent;
- nu există valori brute nejustificate;
- shell-ul controlează gutter-ul;
- layout-ul controlează secțiunile;
- componentele controlează spațiul intern;
- nu există compensări fragile;
- desktopul și mobilul au structură intenționată;
- cardurile nu sunt folosite pentru spacing;
- spațiul gol are un rol;
- modificarea trece verificările automate și vizuale relevante.
