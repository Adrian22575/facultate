# Page Structure Rules

## 1. Rolul documentului

Acest document definește cum se structurează informația într-o pagină `Nota 5+`.

El stabilește:

- responsabilitatea unei pagini;
- ce informație apare imediat;
- ce informație se amână;
- când o funcționalitate trebuie mutată în altă pagină, tab, drawer, modal sau secțiune expandabilă;
- limitele implicite de densitate;
- criteriile pentru dashboard-uri, liste, tabele și formulare;
- ce trebuie eliminat, nu doar rearanjat.

Pentru culori, spacing, componente și CSS folosește `DESIGN_SYSTEM.md` și `LAYOUT_SPACING_RULES.md`.
Pentru responsive folosește `RESPONSIVE_RULES.md`.
Pentru procesul general UI/UX folosește skill-ul canonic `nota5plus-ui-ux-skill.md`.

## 2. Regula responsabilității unice

Fiecare pagină are un singur scop principal.

Scopul paginii trebuie formulat ca rezultat pentru utilizator, nu ca listă de funcționalități.

Exemple corecte:

- utilizatorul continuă pregătirea de unde a rămas;
- utilizatorul găsește și începe un test;
- utilizatorul încarcă și procesează un material;
- administratorul găsește și gestionează un set de înregistrări.

Exemple greșite:

- pagina conține progres, statistici, recomandări, teste și activitate;
- pagina afișează toate funcționalitățile contului;
- pagina centralizează toate datele disponibile.

Dacă o pagină încearcă să servească mai multe obiective independente, structura trebuie separată.

## 3. Contractul obligatoriu al paginii

Înainte de a crea sau redesena o pagină, definește:

```text
Utilizator:
Scop unic:
Decizia principală:
Acțiunea principală:
Maximum două acțiuni secundare:
Informație necesară pentru decizie:
Informație necesară pentru acțiune:
Informație secundară:
Informație care poate fi amânată:
Stări necesare:
Destinații asociate:
Structură desktop:
Structură mobil:
Ce se elimină, mută sau ascunde:
```

Nu începe wireframe-ul sau implementarea dacă structura este bazată doar pe lista de date disponibile.

## 4. Bugetul implicit de conținut

O pagină nouă sau redesenată pornește de la:

- un singur CTA principal;
- maximum două acțiuni secundare vizibile;
- maximum trei zone majore de conținut;
- maximum una sau două idei vizuale dominante;
- un singur nivel principal de navigare locală;
- descrieri de una sau două propoziții;
- detalii avansate ascunse până devin relevante.

Aceste limite pot fi depășite numai când sarcina utilizatorului o cere clar.

Când limitele sunt depășite, propunerea UX trebuie să explice:

- de ce informația trebuie comparată simultan;
- de ce nu poate fi amânată;
- de ce o pagină separată ar afecta fluxul;
- cum rămâne vizibilă acțiunea principală.

## 5. Ierarhia paginii

Ordinea implicită este:

1. context;
2. informația necesară pentru decizia principală;
3. acțiunea principală;
4. rezultatul sau conținutul de lucru;
5. detalii și acțiuni secundare.

### Context

Contextul poate conține:

- titlu concis;
- orientare în produs;
- o propoziție scurtă despre rezultatul paginii;
- stare relevantă pentru continuare.

Nu adăuga un hero mare într-o pagină privată doar pentru branding.

### Acțiunea principală

- apare în zona de scanare inițială;
- are etichetă specifică;
- este dominantă vizual;
- nu concurează cu alte CTA-uri primare;
- nu este repetată în mai multe zone fără motiv.

### Conținutul principal

Conținutul principal trebuie să fie direct legat de scopul paginii.

Nu amesteca în aceeași zonă:

- navigare;
- promovare;
- progres;
- configurare;
- lucru efectiv;
- suport.

Dacă utilizatorul schimbă sarcina, trebuie să existe o separare structurală clară.

## 6. Testul fiecărei secțiuni

Fiecare secțiune trebuie să răspundă la cel puțin una dintre întrebările:

- Ajută utilizatorul să înțeleagă unde se află?
- Ajută utilizatorul să ia decizia principală?
- Ajută utilizatorul să efectueze acțiunea principală?
- Arată starea necesară pentru a continua?
- Oferă detalii solicitate explicit?

Dacă răspunsul este „nu”, secțiunea se:

- elimină;
- mută;
- ascunde implicit;
- combină cu o secțiune existentă.

Nu păstra o secțiune doar pentru că există deja în cod.

## 7. Separarea în pagini și containere

### 7.1 Pagină separată

Folosește o pagină separată când funcționalitatea:

- are un obiectiv distinct;
- presupune mai mulți pași;
- necesită lucru susținut;
- are filtre, stări sau permisiuni proprii;
- trebuie accesată direct prin URL;
- poate fi salvată, distribuită sau reluată;
- ar domina pagina curentă;
- nu trebuie comparată simultan cu restul informației.

Exemple:

- configurarea completă a unui test;
- statistici detaliate;
- editarea unui material;
- administrarea unui set mare de date;
- un flux de onboarding în mai mulți pași.

### 7.2 Tab

Folosește taburi când:

- conținutul aparține aceleiași entități;
- utilizatorul urmărește același obiectiv;
- perspectivele sunt alternative, nu simultane;
- schimbarea tabului nu înseamnă schimbarea majoră a sarcinii.

Nu folosi taburi pentru funcționalități fără legătură doar pentru a economisi spațiu.

### 7.3 Drawer

Folosește drawer când:

- utilizatorul are nevoie de detalii contextuale;
- poziția în listă sau pagină trebuie păstrată;
- sarcina este consultativă sau scurtă;
- închiderea revine natural la contextul anterior.

Nu folosi drawer pentru formulare lungi sau fluxuri cu mai mulți pași.

### 7.4 Modal

Folosește modal pentru:

- confirmare;
- decizie scurtă;
- formular compact;
- acțiune care trebuie finalizată înainte de revenirea la pagină.

Nu folosi modal pentru:

- pagini întregi;
- fluxuri lungi;
- tabele dense;
- navigare principală;
- sarcini care trebuie salvate și reluate.

### 7.5 Secțiune expandabilă

Folosește expandable pentru:

- detalii opționale;
- informație rar necesară;
- explicații care nu trebuie să blocheze sarcina principală.

Nu ascunde în expandable informația necesară pentru decizia principală.

### 7.6 Conținut inline

Păstrează inline informația:

- necesară imediat;
- scurtă;
- direct legată de controlul sau rezultatul afișat;
- care trebuie comparată cu restul conținutului.

## 8. Progressive disclosure

Afișează implicit numai informația necesară pentru pasul curent.

Detaliile avansate pot apărea prin:

- pagină separată;
- tab;
- drawer;
- modal;
- expandable;
- meniu de acțiuni;
- detaliu la cerere.

Nu afișa toate opțiunile doar pentru că utilizatorul ar putea avea nevoie de ele cândva.

Ordinea corectă este:

1. ceea ce trebuie înțeles acum;
2. ceea ce trebuie făcut acum;
3. rezultatul imediat;
4. detalii și opțiuni avansate.

## 9. Reguli pentru dashboard-uri

Nu transforma automat o pagină într-un dashboard.

Un dashboard este justificat numai când utilizatorul trebuie să:

- monitorizeze mai multe stări;
- compare mai multe surse;
- decidă următorul pas pe baza unui rezumat;
- acceseze frecvent mai multe fluxuri independente.

Un dashboard nu trebuie să conțină versiunea completă a fiecărui flux.

Reguli:

- fiecare rezumat trebuie să susțină o decizie;
- statisticile fără acțiune sau interpretare se elimină;
- activitatea recentă apare numai dacă ajută continuarea;
- recomandările trebuie să aibă o sursă și o logică reală;
- cardurile de navigare nu înlocuiesc o navigație clară;
- detaliile apar în paginile dedicate;
- nu adăuga grafice pentru a umple spațiul.

Un dashboard bun spune ce trebuie făcut în continuare.
Un dashboard slab arată tot ce există în produs.

## 10. Liste, toolbars și rezultate

Căutarea, filtrele, sortarea și acțiunile de listă trebuie să fie aproape de rezultatele pe care le modifică.

Ordinea recomandată:

1. titlul și contextul listei;
2. acțiunea principală, dacă există;
3. search, filtre și sortare;
4. rezultate;
5. paginare sau încărcare suplimentară;
6. detalii la cerere.

Reguli:

- nu separa toolbar-ul de listă prin panouri sau spații fără rol;
- nu repeta filtrele în mai multe zone;
- nu păstra filtre rare permanent deschise;
- nu adăuga summary cards deasupra listei dacă nu schimbă decizia;
- nu transforma fiecare rezultat în card complex când un rând sau o listă compactă este suficientă;
- starea fără rezultate trebuie să distingă între listă goală și filtre fără potriviri.

## 11. Tabele

Folosește tabelul când utilizatorul trebuie să compare valori între rânduri și coloane.

Un tabel trebuie să aibă:

- coloane prioritizate;
- etichete clare;
- acțiuni diferențiate semantic;
- search și filtre când volumul o cere;
- paginare sau strategie pentru volum mare;
- tratament pentru texte lungi;
- strategie mobilă.

Nu adăuga:

- card separat pentru titlu;
- card separat pentru toolbar;
- wrapper decorativ inutil în jurul tabelului;
- coloane care nu ajută nicio decizie;
- acțiuni primare în fiecare rând.

Pe mobil, alege explicit:

- coloane prioritare;
- rând compact;
- detaliu la cerere;
- scroll local controlat;
- alt pattern mai potrivit.

Nu înghesui tabelul desktop în viewport.

## 12. Formulare

Formularul este organizat după sarcina utilizatorului, nu după structura bazei de date.

Reguli:

- începe cu informația necesară;
- grupează câmpurile care aparțin aceleiași decizii;
- separă pașii numai când există o schimbare reală de sub-sarcină;
- nu crea wizard pentru un formular scurt;
- nu păstra toate opțiunile avansate vizibile;
- nu folosi helper text dacă label-ul este suficient;
- acțiunea de submit este clară și apare într-un loc previzibil;
- acțiunile distructive sunt separate;
- stările loading, error, success și disabled sunt proiectate explicit.

Un formular lung poate primi pagină proprie când necesită concentrare, validare complexă sau reluare.

## 13. Pagini publice

Paginile publice pot fi mai editoriale, dar trebuie să păstreze:

- o singură promisiune principală în primul ecran;
- un CTA dominant;
- copy scurt;
- secțiuni cu roluri distincte;
- progresie logică până la acțiune.

Nu adăuga automat:

- hero extins;
- beneficii repetate;
- proof fără sursă;
- testimoniale inventate;
- grile SaaS generice;
- CTA după fiecare secțiune.

## 14. Pagini private

Paginile private sunt orientate spre sarcină.

Reguli:

- următorul pas apare înaintea promovării sau explicațiilor;
- progresul apare numai dacă influențează continuarea;
- pricing-ul nu întrerupe sarcina principală;
- navigarea nu este înlocuită de carduri mari;
- informația secundară este mai calmă și poate fi amânată;
- nu copia structura unui landing page în produsul autentificat.

## 15. Pagini admin

Paginile admin prioritizează:

- scanarea;
- căutarea;
- filtrarea;
- comparația;
- acțiunile clare;
- densitatea controlată.

Reguli:

- tabelele sunt patternul implicit pentru date comparabile;
- evită cardurile imbricate;
- separă acțiunile primary, secondary, text și destructive;
- nu adăuga metrici dacă nu susțin o decizie;
- nu împinge conținutul principal sub rezumate decorative;
- păstrează toolbar-ul și rezultatele într-o compoziție coerentă.

## 16. Desktop și mobile

Structura desktop nu este doar versiunea lată a celei mobile, iar mobile nu este doar desktop stivuit.

### Desktop

- folosește coloane numai când informațiile trebuie văzute simultan;
- nu crea o coloană secundară doar pentru echilibru;
- nu întinde controalele pe toată lățimea fără motiv;
- păstrează acțiunea principală în zona de scanare inițială.

### Mobile

Ordinea implicită este:

1. context;
2. informație necesară;
3. acțiune principală;
4. conținut de lucru;
5. detalii;
6. acțiuni secundare.

Pe mobil:

- elimină simultaneitatea care nu mai este utilă;
- prioritizează conținutul;
- mută detaliile la cerere;
- nu păstra două coloane pentru simetrie;
- nu muta acțiunea principală după blocuri secundare;
- nu introduce scroll orizontal la nivel de pagină.

## 17. Elimină, nu doar rearanja

Un redesign nu este reușit dacă mută aceleași elemente într-un grid mai frumos.

Pentru fiecare element existent, decide:

- rămâne;
- se combină;
- se mută;
- se ascunde;
- se elimină.

Elimină elementul când:

- nu susține scopul paginii;
- repetă informația;
- nu este folosit pentru o decizie;
- există doar pentru decor;
- poate fi accesat mai clar în alt loc;
- blochează sarcina principală;
- explică o interfață care trebuie simplificată.

## 18. Anti-pattern-uri

Evită:

- pagini care încearcă să prezinte întreg produsul;
- dashboard mosaic fără ierarhie;
- card pentru fiecare funcționalitate;
- CTA în fiecare card;
- multe acțiuni primare concurente;
- explicații lungi înaintea acțiunii;
- sidebar suplimentar fără nevoie;
- aceleași date în mai multe containere;
- taburi pentru funcționalități fără legătură;
- modaluri pentru fluxuri lungi;
- liste ascunse sub rezumate decorative;
- toolbars separate vizual de rezultate;
- spațiu gol umplut cu texte, metrici sau iconuri;
- conținut secundar deschis implicit;
- pagini care arată complete numai pentru că sunt pline.

## 19. Formatul propunerii de structură

Pentru o pagină nouă sau un redesign amplu, propunerea trebuie să conțină:

```text
Scopul paginii:
Utilizatorul:
Decizia principală:
Acțiunea principală:

Structura propusă:
1.
2.
3.

Desktop:
Mobile:

Ce rămâne:
Ce se combină:
Ce se mută:
Ce se ascunde implicit:
Ce se elimină:

Containere folosite:
- pagini:
- taburi:
- drawer-e:
- modaluri:
- expandable:

Riscuri UX:
1.
2.
3.

Criterii de acceptare:
-
-
-
```

Nu scrie cod în etapa de structură dacă utilizatorul a cerut doar analiză, arhitectură sau wireframe.

## 20. Criterii de acceptare

Structura este acceptabilă când:

- pagina are un singur scop principal;
- acțiunea principală este evidentă;
- informația necesară precede detaliile;
- există maximum două acțiuni secundare vizibile;
- fiecare secțiune are un rol demonstrabil;
- conținutul avansat este amânat;
- containerul ales corespunde sarcinii;
- desktopul și mobilul au ordine intenționată;
- nu există informație repetată;
- nu există carduri, statistici sau texte introduse doar pentru a umple pagina;
- utilizatorul poate identifica rapid unde se află și ce trebuie să facă în continuare.
