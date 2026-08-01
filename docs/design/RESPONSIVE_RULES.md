# Responsive Rules

## 1. Rolul documentului

Acest document definește cum se adaptează interfața `Nota 5+` între desktop, tabletă și mobil.

Responsive nu înseamnă doar micșorarea sau stivuirea layout-ului desktop.
Structura trebuie adaptată sarcinii, priorității informației și modului de interacțiune.

Pentru arhitectura paginii folosește `PAGE_STRUCTURE_RULES.md`.
Pentru spacing și ownership-ul layout-ului folosește `LAYOUT_SPACING_RULES.md`.
Pentru tokenuri și componente folosește `DESIGN_SYSTEM.md`.

## 2. Principiul de bază

Pe orice dimensiune, utilizatorul trebuie să poată:

- înțelege unde se află;
- identifica acțiunea principală;
- citi fără zoom;
- termina fluxul fără scroll orizontal la nivelul paginii;
- accesa toate funcțiile necesare prin touch și tastatură;
- găsi detaliile fără să fie obligat să vadă totul simultan.

Când spațiul se reduce, prioritizează și reorganizează.
Nu comprima mecanic toate elementele.

## 3. Ordinea conținutului

Ordinea mobilă implicită este:

1. context;
2. informația necesară pentru decizia curentă;
3. acțiunea principală;
4. conținutul de lucru;
5. detalii;
6. acțiuni secundare.

Ordinea desktop poate folosi simultaneitate numai când aceasta ajută sarcina.

Nu păstra pe mobil o ordine determinată doar de poziția vizuală din desktop.
Ordinea DOM trebuie să rămână logică pentru citire, tastatură și tehnologii asistive.

## 4. Breakpoint-uri

Folosește breakpoint-urile deja aprobate în proiect.

Shell-ul aplicației tratează desktopul de la `901px` în sus, dacă implementarea activă nu a fost schimbată printr-o decizie documentată.

Reguli:

- nu introduce breakpoint-uri arbitrare pentru un singur padding;
- adaugă un breakpoint numai când se schimbă structura sau comportamentul;
- nu crea intervale foarte înguste care funcționează doar la dimensiunile testate;
- nu rezolva fiecare componentă cu propriile breakpoint-uri dacă problema aparține shell-ului;
- dacă mai multe componente au nevoie de aceeași schimbare, extinde sistemul și documentează motivul.

Dimensiunile obligatorii de verificare sunt:

- `1440px`;
- `1024px`;
- `768px`;
- `390px`.

Verifică și dimensiuni intermediare când layout-ul pare fragil.

## 5. Strategia desktop

Pe desktop:

- folosește coloane numai când informațiile trebuie văzute simultan;
- păstrează o axă vizuală clară între header, toolbar și conținut;
- nu întinde textul, formularele și controalele pe toată lățimea fără motiv;
- nu adăuga o coloană secundară doar pentru echilibru vizual;
- nu folosi spațiul disponibil pentru a adăuga conținut secundar;
- acțiunea principală trebuie să rămână evidentă;
- conținutul critic nu trebuie împins sub rezumate decorative.

Un viewport mare nu justifică mai multe carduri, texte sau metrici.

## 6. Strategia pentru tabletă

La lățimi intermediare:

- verifică dacă două coloane mai sunt utile;
- nu aștepta breakpoint-ul mobil pentru a rearanja un toolbar care deja nu încape;
- prioritizează conținutul înainte de a reduce fonturile;
- evită tranzițiile bruște între desktop foarte larg și mobil;
- verifică wrapping-ul titlurilor, taburilor, filtrelor și butoanelor;
- păstrează acțiunile importante într-o zonă predictibilă.

Tableta nu trebuie tratată automat ca desktop îngust sau mobil lat.

## 7. Strategia mobilă

Pe mobil:

- folosește o singură coloană pentru zonele principale;
- redu mai întâi gutter-ul exterior;
- păstrează spacing-ul intern suficient;
- menține targeturile interactive la minimum `44px`;
- folosește tokenul `--touch-target` când se aplică;
- nu permite scroll orizontal la nivelul paginii;
- nu ascunde funcții necesare doar pentru a simplifica vizual;
- nu baza accesul la hover;
- nu păstra două coloane doar pentru simetrie;
- nu muta acțiunea principală după detalii secundare;
- nu micșora fontul sau butoanele pentru a salva un layout greșit.

## 8. Reflow și prioritizare

Când un layout nu mai încape, aplică în această ordine:

1. elimină simultaneitatea care nu este necesară;
2. mută detaliile secundare la cerere;
3. reorganizează coloanele;
4. permite wrapping controlat;
5. transformă acțiunile rare într-un meniu;
6. limitează lățimea controalelor care nu trebuie să fie full-width;
7. folosește scroll local numai când conținutul o cere;
8. abia apoi ajustează spacing-ul în limitele sistemului.

Nu rezolva problema prin:

- overflow ascuns care taie conținut;
- micșorarea excesivă a textului;
- poziționare absolută;
- transformări;
- lărgirea artificială a paginii;
- ascunderea acțiunilor obligatorii.

## 9. Header și navigare globală

Navigarea trebuie să aibă strategie explicită pentru fiecare lățime.

Pe desktop:

- păstrează destinațiile principale vizibile;
- nu aglomera header-ul cu statusuri și informații secundare;
- separă clar navigarea de acțiunile contului.

Pe mobil:

- prioritizează brandul, destinația curentă și accesul la navigare;
- folosește meniu, sheet sau alt pattern controlat;
- păstrează focusul în interiorul meniului deschis;
- suportă Escape și închiderea clară;
- nu acoperi conținutul important;
- respectă safe areas;
- nu pune toate linkurile într-un rând cu scroll necontrolat.

## 10. Page header

Pe desktop, titlul și acțiunile pot apărea pe același rând dacă există spațiu real.

Pe mobil:

- titlul apare înaintea acțiunilor;
- descrierea rămâne scurtă;
- CTA-ul principal este vizibil și ușor de atins;
- acțiunile secundare pot fi stivuite sau mutate într-un meniu;
- nu lăsa butoanele să se micșoreze sub dimensiunea utilă;
- nu produce rânduri fragile cu trei sau patru acțiuni concurente.

## 11. Toolbars, search și filtre

Fiecare toolbar trebuie să definească explicit comportamentul mobil.

Strategii permise:

- stivuire pe rânduri;
- search full-width și filtre dedesubt;
- filtre într-un drawer sau modal compact;
- acțiuni rare într-un meniu;
- segmented controls cu wrapping;
- scroll local controlat pentru taburi, când etichetele trebuie păstrate.

Reguli:

- păstrează search-ul aproape de rezultate;
- nu muta filtrele într-o zonă fără legătură cu lista;
- nu ascunde indicatorul filtrelor active;
- oferă reset clar când filtrele pot produce zero rezultate;
- nu lăsa controalele să depășească viewport-ul;
- nu folosi scroll orizontal pentru întreg toolbar-ul dacă acțiunile au priorități diferite;
- acțiunea principală nu trebuie confundată cu filtrele.

## 12. Taburi

Taburile sunt potrivite numai când conținutul reprezintă perspective ale aceleiași entități și aceluiași scop.

Pe mobil, alege una dintre strategii:

- etichete scurte cu wrapping;
- scroll local controlat și indicator vizibil;
- meniu/select când sunt multe opțiuni;
- prioritizarea taburilor principale;
- împărțirea în pagini separate dacă sarcinile sunt de fapt distincte.

Nu micșora textul taburilor până devine greu de citit.
Nu ascunde taburile importante fără o alternativă clară.

## 13. Sidebar-uri

Un sidebar desktop nu devine automat drawer pe mobil.

Înainte de transformare, decide dacă informația este:

- navigare principală;
- filtru;
- detaliu contextual;
- acțiune secundară;
- informație care poate fi eliminată sau mutată.

Strategii mobile:

- navigarea devine meniu sau sheet;
- filtrele devin drawer/modal;
- detaliile contextuale devin secțiune expandabilă sau pagină;
- conținutul esențial intră în fluxul principal.

Nu păstra două sidebar-uri și nu crea un al doilea drawer fără aprobare explicită.

## 14. Carduri și grid-uri

Pe desktop, un grid este justificat numai când elementele sunt comparabile și autonome.

Pe mobil:

- cardurile se afișează într-o singură coloană;
- ordinea este bazată pe prioritate;
- conținutul secundar poate fi redus sau ascuns;
- acțiunile rămân ușor de atins;
- nu păstra înălțimi egale dacă produc goluri mari;
- nu transforma fiecare rând de listă într-un card voluminos.

Un grid de desktop nu trebuie păstrat ca un șir lung de carduri dacă o listă compactă servește mai bine sarcina mobilă.

## 15. Liste

Listele mobile trebuie să prioritizeze:

- titlul sau identificatorul;
- starea;
- informația necesară pentru decizie;
- acțiunea principală sau accesul la detalii.

Informația secundară poate fi mutată în:

- detaliu la cerere;
- drawer;
- pagină separată;
- expandable;
- meniu de acțiuni.

Reguli:

- nu repeta toate metadatele pe mobil;
- nu comprima textul până devine ilizibil;
- nu pune multe butoane în fiecare rând;
- păstrează targetul tactil;
- diferențiază acțiunea pe rând de deschiderea detaliilor.

## 16. Tabele

Un tabel desktop trebuie să aibă o strategie mobilă explicită.

Opțiuni:

- păstrează numai coloanele prioritare;
- transformă rândul într-o structură compactă;
- afișează detalii la cerere;
- folosește scroll local controlat când comparația pe coloane este esențială;
- separă datele în vizualizări diferite;
- oferă filtrare pentru reducerea volumului.

Reguli:

- nu permite scroll orizontal la nivelul paginii;
- nu înghesui toate coloanele;
- nu micșora textul sub limita sistemului;
- nu rupe datele și orele fără motiv;
- nu lăsa coloanele lungi să producă rânduri exagerat de înalte;
- acțiunile trebuie să rămână accesibile prin touch și tastatură;
- dacă folosești scroll local, indică vizual că există conținut suplimentar.

## 17. Formulare

Pe mobil:

- câmpurile sunt de regulă full-width;
- label-ul rămâne vizibil;
- helper text-ul este scurt;
- erorile apar lângă câmp;
- tastatura nu trebuie să acopere acțiunea fără posibilitatea de scroll;
- butoanele de submit și anulare au ordine clară;
- targeturile tactile respectă sistemul;
- grupurile de câmpuri rămân distincte.

Pentru formulare lungi:

- folosește pași numai când există sub-sarcini reale;
- păstrează progresul și posibilitatea de revenire;
- nu ascunde erorile într-un pas precedent;
- nu folosi două coloane pe mobil.

## 18. Dialoguri, sheets și drawers

Pe ecrane mici:

- dialogurile trebuie să încapă în viewport;
- conținutul intern poate avea scroll, nu pagina din spate;
- acțiunile importante rămân accesibile;
- focusul este controlat;
- Escape și butonul de închidere funcționează;
- safe area de jos este respectată;
- sheet-ul nu trebuie să acopere complet contextul fără motiv.

Nu folosi modal sau drawer pentru fluxuri lungi doar pentru a evita o pagină separată.

## 19. Elemente fixe și sticky

Elementele sticky sau fixed sunt permise numai dacă ajută finalizarea sarcinii.

Reguli:

- nu acoperi conținutul;
- respectă safe areas;
- nu dubla acțiunea principală fără motiv;
- verifică tastatura mobilă;
- verifică scroll-ul și focusul;
- oferă suficient spațiu la finalul conținutului;
- nu fixa toolbars mari care reduc excesiv viewport-ul.

## 20. Text și conținut lung

Verifică:

- titluri lungi;
- nume de materii;
- instituții;
- mesaje de eroare;
- badge-uri;
- butoane;
- date și ore;
- texte traduse sau dinamice.

Reguli:

- permite wrapping când sensul rămâne clar;
- folosește truncation numai când există acces la valoarea completă;
- nu fixa înălțimi care taie textul;
- nu folosi `white-space: nowrap` fără motiv;
- nu lăsa un singur element lung să lărgească pagina;
- butoanele trebuie să rămână ușor de înțeles după wrapping.

## 21. Imagini și media

- Media trebuie să aibă dimensiuni responsive și aspect ratio controlat.
- Nu permite imaginilor să depășească containerul.
- Nu folosi imagini decorative pentru a umple spațiul mobil.
- Păstrează informația importantă în text, nu numai în imagine.
- Oferă text alternativ relevant.
- Mockup-urile publice pot fi simplificate sau eliminate pe mobil dacă nu susțin acțiunea principală.

## 22. Hover, touch și tastatură

Orice funcție disponibilă la hover trebuie să fie disponibilă și prin:

- touch;
- focus;
- tastatură;
- control vizibil.

Reguli:

- hover-ul nu este singurul indicator;
- focusul este vizibil;
- icon buttons au etichetă accesibilă;
- meniurile se pot deschide și închide fără mouse;
- acțiunile textuale nu trebuie să moștenească hover-ul butoanelor pline;
- stările active și selected nu sunt comunicate numai prin culoare.

## 23. Stări responsive

Verifică separat:

- loading;
- empty;
- error;
- success;
- disabled;
- permission denied;
- listă fără rezultate;
- conținut foarte lung;
- multe rezultate;
- dialog deschis;
- tastatură mobilă activă.

O stare goală nu trebuie să introducă un bloc mai mare și mai decorativ decât pagina cu conținut.
O eroare lungă nu trebuie să producă overflow.

## 24. Verificare vizuală

Pentru schimbări responsive, verifică:

- `1440px`;
- `1024px`;
- `768px`;
- `390px`.

La fiecare dimensiune verifică:

- ordinea conținutului;
- acțiunea principală;
- wrapping-ul;
- overflow-ul;
- navigarea;
- toolbars;
- taburile;
- tabelele;
- dialogurile;
- targeturile tactile;
- focusul;
- elementele fixed/sticky;
- spațiul gol;
- conținutul lung.

Nu considera responsive-ul verificat doar pentru că browserul nu afișează scroll orizontal la cele patru dimensiuni.
Testează și tranzițiile dintre ele când structura este complexă.

## 25. Anti-pattern-uri

Evită:

- desktop micșorat mecanic;
- toate coloanele stivuite fără prioritizare;
- scroll orizontal la nivel de pagină;
- text sau butoane micșorate pentru a încăpea;
- acțiunea principală împinsă sub conținut secundar;
- toate filtrele permanent vizibile;
- taburi cu text ilizibil;
- tabel desktop înghesuit pe mobil;
- sidebar transformat automat în drawer;
- elemente fixed care acoperă conținutul;
- hover ca unic mod de acces;
- breakpoint-uri locale arbitrare;
- ascunderea funcțiilor necesare fără alternativă;
- carduri voluminoase pentru fiecare rând;
- două coloane păstrate doar pentru simetrie.

## 26. Criterii de acceptare

Responsive-ul este acceptabil când:

- structura se adaptează sarcinii;
- ordinea mobilă este intenționată;
- acțiunea principală rămâne vizibilă;
- nu există scroll orizontal la nivelul paginii;
- textul este lizibil fără zoom;
- targeturile tactile sunt suficiente;
- toate funcțiile pot fi folosite prin touch și tastatură;
- toolbars, taburile și tabelele au strategii explicite;
- elementele fixed nu acoperă conținutul;
- conținutul lung nu rupe layout-ul;
- breakpoint-urile sunt justificate structural;
- stările relevante au fost verificate.
