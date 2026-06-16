# Modul nou: Invata din materia incarcata

## Scop

Utilizatorul incarca o materie proprie, iar aplicatia o transforma intr-un spatiu de invatare organizat: capitole, rezumate, concepte, flashcards, intrebari, teste si plan de invatare. Modulul trebuie sa para un produs de studiu complet, nu doar un import de grile.

Acest document este sursa de tracking pentru implementare. Cand incepe goal-ul de implementare, verifica acest fisier si bifeaza cerintele pe masura ce sunt finalizate.

## Decizie produs: pagina separata sau integrat in siteul actual

Decizie recomandata: nu facem un landing page complet separat la inceput.

Motiv:
- `/materiale` este deja Workspace-ul unde utilizatorul incarca fisiere si text.
- Exista deja upload, salvare documente, istoric joburi, review, teste si explicatii.
- Un landing page separat ar dubla mesajul si ar adauga munca de marketing inainte sa existe flow-ul complet.

Implementare recomandata:
1. Adaugam in Workspace o alegere clara intre:
   - `Genereaza teste grila din intrebari existente`
   - `Invata din materia ta`
   - `Pregateste licenta`
2. `Invata din materia ta` devine un flow dedicat, ideal cu ruta proprie:
   - `/materiale/invata`
   - `/materiale/invata/[studySetId]`
3. Landing-ul public actual primeste doar o sectiune noua si CTA spre Workspace:
   - "Incarca materia ta si transform-o in teste, flashcards si plan de invatare."
4. Dupa ce flow-ul este validat cu utilizatori reali, putem face landing separat daca analytics-ul arata ca oamenii intra special pentru aceasta functie.

## Principiu important

Nu generam de 8 ori acelasi continut in moduri diferite.

Trebuie sa avem o singura procesare initiala care produce o structura comuna:
- capitole
- concepte
- termeni-cheie
- rezumate
- intrebari grila
- intrebari deschise
- flashcards
- explicatii
- estimare nivel si timp

Modurile din UI folosesc aceasta structura. Altfel costul creste, timpul de procesare creste si apar diferente intre moduri.

## Rezumat executiv

Obiectivul nu este "inca un generator de teste", ci o experienta de invatare completa pornita din materia utilizatorului. Diferenta fata de flow-ul actual de Workspace:

- flow-ul actual: utilizatorul are deja intrebari/raspunsuri si vrea sa le importe in teste;
- flow-ul nou: utilizatorul are cursuri, notite, PDF-uri, DOCX-uri sau slide-uri si vrea sa invete din ele.

Decizia de produs recomandata:

1. Incepem integrat in Workspace, sub `/materiale/invata`.
2. Nu facem landing separat pana nu validam ca oamenii folosesc flow-ul dupa upload.
3. Construim un `study_set` unic, apoi modurile de invatare citesc din el.
4. MVP-ul trebuie sa livreze cel putin: analiza materiei, capitole, flashcards, test grila, greseli si plan simplu.
5. Simularea examen mixta si PPTX complet pot fi etapizate daca riscul devine prea mare.

## Pozitionare in produs

### Cum ar trebui sa fie perceput

Utilizatorul trebuie sa simta:

- "Am incarcat materia si acum am un plan clar."
- "Nu mai caut prin PDF-uri."
- "Stiu ce capitole am, ce e important si ce trebuie repetat."
- "Aplicatia ma ajuta sa invat, nu doar sa dau teste."

### Diferentiere fata de competitori sau un chat general

Nu vrem doar un camp in care utilizatorul intreaba lucruri despre PDF. Modulul trebuie sa ofere:

- structura persistenta;
- progres;
- sesiuni de invatare;
- greseli salvate;
- plan de invatare;
- continut reutilizabil;
- analytics in Admin.

Un chat simplu peste document poate fi adaugat mai tarziu, dar nu este baza produsului.

## Tipuri de utilizatori si cazuri de folosire

### Student cu examen aproape

Are PDF-uri sau cursuri mari. Vrea:

- capitole rapide;
- rezumate;
- flashcards;
- test pe capitole;
- recapitulare inainte de examen.

Prioritate UX:
- timp recomandat;
- plan pe zile;
- test din greseli.

### Student care pregateste colocviu/grila

Are materia teoretica, dar nu are intrebari gata facute.

Vrea:
- intrebari grila generate;
- explicatii la raspunsuri;
- dificultate mixta;
- test rapid.

Prioritate UX:
- configurare test;
- explicatii la final;
- recomandare capitol slab.

### Elev

Are lectii/notite. Vrea:

- explicatii simple;
- exemple concrete;
- flashcards;
- intrebari scurte.

Prioritate UX:
- `Explica-mi simplu`;
- mai putine setari;
- copy mai calm si mai direct.

### Utilizator grabit

Nu vrea sa configureze mult. Vrea un rezultat imediat.

Prioritate UX:
- buton `Fa-mi un plan rapid`;
- buton `Incepe cu flashcards`;
- buton `Da un test de 10 intrebari`.

## Arhitectura experientei

Flow recomandat:

1. Workspace: utilizatorul alege `Invata din materia ta`.
2. Upload: alege sursa si completeaza doar datele care conteaza.
3. Procesare: vede progresul si poate pleca din pagina.
4. Analiza: vede sumarul materiei si actiunile principale.
5. Study set: lucreaza pe capitole, flashcards, teste, greseli si plan.
6. Progres: aplicatia tine minte ce a facut si ce ar trebui sa repete.

Regula:
- daca procesarea dureaza, utilizatorul trebuie sa aiba link in activitate si notificare interna, nu sa fie obligat sa astepte cu pagina deschisa.

## Information architecture

### Rute recomandate

- `/materiale`
  - hub Workspace cu carduri de alegere.
- `/materiale/invata`
  - upload si configurare study set.
- `/materiale/invata/[studySetId]`
  - overview si moduri de invatare.
- `/materiale/invata/[studySetId]/capitole/[chapterId]`
  - optional, daca pagina de capitol devine prea bogata pentru tab.
- `/materiale/activitate`
  - include si study sets in istoric.

### Navigatie in study set

Taburi recomandate:

- Overview
- Capitole
- Flashcards
- Test
- Greseli
- Plan

Pe mobil:

- taburile devin chips scrollabile;
- actiunile principale apar sus: `Continua`, `Flashcards`, `Test rapid`;
- continutul lung se sparge in sectiuni, nu carduri imbricate.

## Stari de produs

### Study set statuses

- `draft`: utilizatorul a inceput formularul, dar nu a trimis.
- `uploaded`: sursa este salvata.
- `extracting`: textul este extras.
- `outlining`: detectam capitolele si structura.
- `generating`: producem capitole, concepte, intrebari si flashcards.
- `consolidating`: eliminam duplicate si calculam statistici.
- `ready`: utilizatorul poate invata.
- `ready_with_warnings`: utilizatorul poate invata, dar exista avertismente.
- `failed`: procesarea a esuat.

### De ce avem nevoie de `ready_with_warnings`

Multe materiale reale vor fi imperfecte:

- PDF scanat prost;
- notite fara titluri;
- slide-uri foarte scurte;
- continut prea putin pentru intrebari grele.

Nu trebuie sa blocam totul daca avem suficient continut util. Afisam:

- ce am putut genera;
- ce lipseste;
- ce poate face utilizatorul.

## UX detaliat pe ecrane

### Workspace hub

In loc sa inceapa direct cu formularul vechi, Workspace trebuie sa intre printr-o alegere simpla:

1. `Invata din materia ta`
   - pentru cursuri, notite, PDF-uri, DOCX-uri, slide-uri;
   - CTA: `Incarca materia`.
2. `Importa intrebari existente`
   - pentru grile care au deja variante si raspunsuri;
   - CTA: `Pregateste test grila`.
3. `Pregateste licenta`
   - pentru seturi de licenta;
   - CTA: `Construieste licenta`.

Aceasta schimbare reduce confuzia dintre "am materie" si "am grile".

### Upload study set

Primul ecran trebuie sa fie scurt:

- headline: `Incarca materia ta si transform-o in teste, flashcards si plan de invatare.`
- subcopy: `PDF, DOCX, text lipit sau PowerPoint. Dupa procesare vezi capitolele, conceptele importante si ce merita repetat.`

Sectiuni:

1. Sursa
   - PDF
   - DOCX
   - text lipit
   - PPTX daca este activ
2. Detalii optionale
   - titlu materie;
   - data examenului;
   - minute pe zi;
   - nivel actual;
   - obiectiv.
3. Cost/consum
   - `Aceasta procesare foloseste 1 incarcare.`
   - daca politica se schimba, mesajul se actualizeaza.

Nu punem:

- explicatii tehnice;
- cuvinte precum AI/OpenAI;
- prea multe setari de generare inainte de primul rezultat.

### Procesare

Ecranul de procesare trebuie sa arate progres real, nu doar spinner.

Etape vizibile:

- `Pregatim fisierul`
- `Citim materia`
- `Gasim capitolele`
- `Construim materialele de invatare`
- `Verificam rezultatul`

Detalii utile:

- mesaj ca poate reveni din activitate;
- estimare aproximativa daca exista;
- status pentru erori recuperabile.

### Analiza materiei

Acesta este momentul de incredere.

Layout recomandat:

- card mare cu status: `Materia a fost analizata`
- grid de statistici:
  - pagini estimate;
  - capitole;
  - concepte;
  - intrebari;
  - flashcards;
  - timp recomandat.
- avertismente, daca exista:
  - `Am gasit capitole fara titlu clar`
  - `Unele intrebari sunt orientative`
  - `Textul pare extras partial`
- actiuni principale:
  - `Incepe cu planul`
  - `Invata pe capitole`
  - `Flashcards`
  - `Test rapid`

### Overview study set

Rol:
- sa fie dashboard-ul personal pentru materia incarcata.

Trebuie sa includa:

- progres general;
- activitatea urmatoare recomandata;
- capitole cu status;
- scoruri recente;
- flashcards de repetat;
- greseli ramase.

CTA principal:
- daca exista plan: `Continua ziua de azi`;
- daca nu exista plan: `Incepe cu capitolul 1` sau `Fa un test rapid`.

### Capitole

Fiecare capitol trebuie sa fie o unitate completa de invatare.

Structura capitol:

- titlu capitol;
- rezumat scurt;
- idei importante;
- termeni-cheie;
- concepte;
- actiuni:
  - `Flashcards capitol`
  - `Test capitol`
  - `Explica-mi conceptele`

Regula:
- daca un capitol are prea putin continut, il marcam si il unim logic cu alt capitol sau il afisam ca sectiune scurta.

### Flashcards

Experienta trebuie sa fie rapida si tactila.

Layout:
- card central;
- progres: `12 / 40`;
- fata/spate;
- butoane mari:
  - `Nu stiu`
  - `Aproape`
  - `Stiu`
  - `Mai tarziu`

Reguli UX:

- pe mobil, butoanele stau jos si sunt usor de apasat;
- dupa raspuns, trecerea la urmatorul card trebuie sa fie imediata;
- la final, utilizatorul vede cate carduri revin.

### Test

Testul trebuie sa aiba doua moduri:

1. `Test rapid`
   - 10 intrebari;
   - dificultate mixta;
   - toate capitolele;
   - explicatii la final.
2. `Test personalizat`
   - numar intrebari;
   - capitole;
   - dificultate;
   - explicatii imediat/final;
   - timp limita.

Regula:
- pentru prima versiune, `Test rapid` trebuie sa fie foarte vizibil. Setarile avansate nu trebuie sa blocheze utilizatorul grabit.

### Rezultate test

Trebuie sa raspunda la 3 intrebari:

- cat am luat?
- ce am gresit?
- ce repet acum?

Include:

- scor;
- lista greseli;
- raspuns corect;
- explicatie;
- capitole slabe;
- CTA:
  - `Repeta greselile`
  - `Flashcards din greseli`
  - `Test nou din capitolul slab`

### Plan de invatare

Planul nu trebuie sa fie doar text. Trebuie sa devina navigatie.

Fiecare zi contine actiuni clickabile:

- capitol;
- flashcards;
- test;
- greseli;
- simulare.

Stari:

- `Azi`
- `Urmeaza`
- `Finalizat`
- `Depasit`

Pentru MVP:
- generam planul o data;
- recalcularea adaptiva vine dupa ce avem date despre scoruri.

## Cost si optimizare

### Principiu de cost

Costul mare vine din procesarea initiala, nu din afisarea modurilor. De aceea:

- generam structura o data;
- salvam rezultatele;
- nu regeneram flashcards/intrebari la fiecare intrare in tab;
- folosim datele salvate pentru quiz, flashcards, greseli si plan.

### Strategii concrete

1. Extractie si preprocesare locala unde se poate
   - PDF/DOCX/TXT/PPTX: extragem textul in backend.
   - curatam whitespace, headers/footers repetitive, pagini goale.

2. Outline inainte de generare completa
   - intai detectam capitolele si structura;
   - apoi generam continut pe capitole.

3. Buget pe capitol
   - fiecare capitol primeste un numar tinta de:
     - concepte;
     - flashcards;
     - intrebari.
   - evitam capitole cu 80 de flashcards si altele cu 0.

4. Deduplicare dupa generare
   - concepte similare;
   - intrebari aproape identice;
   - flashcards care repeta aceeasi definitie.

5. Salvare partiala
   - daca procesarea capitolului 5 esueaza, capitolele 1-4 raman disponibile.

6. Regenerare selectiva
   - daca un capitol este slab, regeneram doar capitolul respectiv.
   - nu refacem tot study set-ul.

7. Limite clare
   - numar maxim de capitole in MVP;
   - numar maxim de concepte/capitol;
   - numar maxim de flashcards/capitol;
   - numar maxim de intrebari/capitol.

### Propunere limite MVP

Acestea sunt valori initiale, ajustabile dupa teste:

- maxim 12 capitole procesate complet;
- maxim 8 concepte/capitol;
- maxim 10 flashcards/capitol;
- maxim 10 intrebari/capitol;
- daca documentul este foarte mare, prioritizam capitolele detectate ca relevante si afisam avertisment.

### Niveluri de procesare

Pentru control cost/produs putem avea intern:

- `standard`
  - rezumate, concepte, flashcards, grile, plan simplu.
- `deep`
  - mai multe intrebari, intrebari deschise, simulare mixta, explicatii mai bogate.

In UI final nu folosim termeni tehnici. Daca expunem alegerea:

- `Rapid`
- `Complet`

Dar recomandarea pentru MVP:
- nu expunem alegerea;
- folosim intern `standard`.

### Cost analytics necesar

In Admin trebuie sa putem vedea:

- cost estimat per study set;
- durata procesarii;
- capitole generate;
- output util per incarcare;
- rata de esec;
- cate study sets sunt deschise dupa procesare;
- cate ajung la test/flashcards.

Scopul nu este doar sa stim cat costa, ci daca produce invatare reala.

## Calitate continut

### Quality gates

Un study set poate deveni `ready` doar daca are minim:

- 1 capitol;
- 1 rezumat;
- cateva concepte sau idei importante;
- cel putin un tip de activitate: flashcards sau intrebari.

Devine `ready_with_warnings` daca:

- unele capitole sunt incomplete;
- intrebarile au incredere scazuta;
- textul extras este dezordonat;
- numarul de flashcards este sub tinta.

Devine `failed` daca:

- nu se poate extrage text util;
- documentul este prea mic;
- procesarea nu produce nicio unitate de invatare.

### Scor de incredere

Pentru fiecare artifact salvat putem avea:

- `confidence`
- `quality_status`
- `quality_notes`

Unde se aplica:

- capitole;
- concepte;
- intrebari;
- flashcards.

In UI nu trebuie sa aratam scor brut. Aratam mesaje:

- `Bun pentru invatare`
- `Verifica formularea`
- `Generat orientativ`

## Contracte de generare

Pentru implementare, fiecare etapa trebuie sa aiba schema stricta. Nu acceptam raspuns liber.

### Outline schema

Trebuie sa intoarca:

- titlu materie;
- capitole;
- pozitie capitol;
- titlu capitol;
- scurt motiv pentru capitol;
- indicii sursa: pagina/sectiune/chunk.

### Chapter artifact schema

Pentru fiecare capitol:

- summary;
- key_ideas;
- key_terms;
- concepts;
- flashcards;
- questions;
- warnings.

### Consolidation schema

Trebuie sa intoarca:

- duplicate eliminate;
- capitole unite;
- concepte globale;
- statistici finale;
- warnings finale;
- recomandare nivel;
- recomandare zile de invatare.

## Optimizare tehnica

### Joburi asincrone

Nu procesam totul in requestul de upload.

Flow:

1. Upload creeaza `learning_study_set`.
2. API-ul returneaza redirect spre pagina de status.
3. Procesarea ruleaza prin job route, similar cu flow-urile existente.
4. Clientul face polling moderat.
5. Utilizatorul poate reveni din activitate.

### Polling

Regula:

- polling rapid doar in primele secunde;
- apoi 2-5 secunde;
- nu polling la 200ms.

Scop:
- sa nu incarcam serverul inutil;
- sa evitam problema observata anterior cu verificari prea dese.

### Idempotenta

Trebuie sa existe protectie la:

- refresh dupa upload;
- dublu click pe submit;
- retry job;
- reluare dupa eroare.

Pentru study set:

- `idempotency_key` in metadata sau coloana dedicata;
- status transitions controlate.

### Salvare partiala

Fiecare capitol generat se poate salva imediat.

Avantaj:
- daca pica ultima etapa, utilizatorul nu pierde tot;
- Admin poate vedea unde pica;
- putem relua doar capitolele lipsa.

## Securitate si date

Reguli:

- toate tabelele au `user_id`;
- RLS owner-only;
- service role doar in backend;
- nu expunem storage path privat direct in UI;
- nu logam continut complet al documentelor in console;
- logurile admin pot avea preview-uri scurte, dar nu document complet.

Date sensibile:

- cursuri private;
- materiale de facultate;
- continut posibil protejat de profesor/institutie.

De aceea:

- afisam utilizatorului ca materialul ramane in contul lui/comunitatea potrivita, dupa regulile existente;
- nu publicam automat study set-ul in comunitate;
- study set-ul este privat implicit.

## Comunitate, reutilizare si competitie

Directia de produs recomandata este sa pastram modulul in jurul ideii de comunitate. Daca o clasa, grupa sau facultate are deja o materie procesata bine, nu are sens ca fiecare utilizator sa consume cate o incarcare pentru acelasi continut.

### Principiu comunitate

- procesarea costa o singura data;
- continutul bun poate fi reutilizat de comunitatea potrivita;
- utilizatorul care incarca ramane in control la publicare;
- comunitatea primeste valoare fara cost repetat;
- aplicatia castiga retentie prin progres, comparatii si competitie sanatoasa.

### Regula recomandata de publicare

Flux:

1. Utilizatorul incarca materia.
2. Study set-ul este procesat privat.
3. Utilizatorul verifica rezultatul.
4. Daca rezultatul este bun, apare actiunea:
   - `Publica pentru clasa/grupa ta`
5. Dupa publicare, study set-ul devine disponibil pentru comunitatea academica potrivita.

Nu publicam automat brut imediat dupa procesare, pentru ca:

- materialul poate fi personal;
- poate contine greseli;
- poate fi incomplet;
- poate fi incarcat in comunitatea gresita;
- poate avea continut care nu trebuie distribuit.

### Cine vede materialul publicat

Regula trebuie sa foloseasca structura academica existenta.

Pentru elev:

- aceeasi scoala;
- aceeasi clasa, daca este disponibila;
- acelasi semestru sau context de materie, daca este relevant.

Pentru student:

- aceeasi universitate/institutie;
- aceeasi facultate/program;
- acelasi an;
- acelasi semestru;
- materia sau contextul in care a fost publicat.

Nu recomand publicare automata la nivel de toata facultatea daca materialul este pentru o grupa/an/semestru specific. Mai bine publicare pe cel mai specific context disponibil.

### Cost pentru comunitate

Recomandare:

- utilizatorul care proceseaza consuma 1 incarcare;
- ceilalti utilizatori din comunitatea potrivita folosesc study set-ul publicat fara sa consume incarcare;
- daca cineva vrea sa modifice/regenerereze continutul pentru el, atunci creeaza o copie privata si poate consuma o incarcare noua;
- daca materialul publicat este doar folosit pentru teste/flashcards, nu se consuma nimic extra.

Motiv:

- incurajeaza partajarea;
- reduce costuri duplicate;
- creste valoarea comunitatii;
- face produsul mai atractiv pentru clase/grupe intregi.

### Contributie si reward pentru creator

Pentru ca utilizatorii sa incarce materiale bune, putem recompensa contributorii.

Idei:

- badge `Contributor`;
- badge `Material popular`;
- o incarcare bonus dupa ce materialul este folosit de X colegi;
- puncte de reputatie in comunitate;
- afisare discreta: `Incarcat de un coleg din comunitatea ta`;
- top contributori ai saptamanii.

Important:
- reward-ul trebuie sa fie conditionat de folosire reala sau feedback pozitiv, nu doar de upload.

### Competitie sanatoasa

Scop:
- sa creasca motivatia fara sa creeze rusine sau presiune inutila.

Functii posibile:

- top scoruri pe study set;
- progres pe capitole;
- flashcards finalizate;
- streak de invatare;
- cei mai activi utilizatori ai saptamanii;
- media comunitatii pe un test;
- comparatie personala: `Esti peste media clasei la Capitolul 3`;
- capitole unde comunitatea greseste cel mai des.

Recomandare UX:

- folosim ranguri, percentile si badge-uri mai mult decat note brute;
- putem permite anonimizare in leaderboard;
- nu afisam public toate greselile unui utilizator;
- progresul personal ramane privat;
- comunitatea vede agregate si topuri, nu detalii sensibile.

### Leaderboard recomandat

Niveluri:

1. Leaderboard pe study set
   - scoruri test;
   - completare flashcards;
   - progres pe capitole.
2. Leaderboard pe comunitate
   - activitate saptamanala;
   - contributori;
   - materiale populare.
3. Comparatie personala
   - scorul tau vs media comunitatii;
   - capitolele tale slabe vs capitolele slabe ale comunitatii.

MVP comunitate:

- study set publicabil manual;
- lista `Materiale din comunitatea ta`;
- folosire fara incarcare pentru ceilalti;
- statistici agregate simple: utilizatori, teste finalizate, scor mediu;
- leaderboard optional doar pe scor test/study set.

Faza urmatoare:

- badge-uri;
- streak;
- top contributori;
- comparatii pe capitole;
- recomandari bazate pe ce greseste comunitatea.

### Moderare si calitate comunitate

Materialele publicate trebuie sa aiba mecanisme minime:

- raportare material problematic;
- ascundere/depublicare de catre admin;
- marcaj `publicat de comunitate`;
- afisare warnings daca study set-ul are calitate partiala;
- posibilitatea ca adminul sa vada cele mai folosite materiale si cele raportate.

Nu recomand sa intre in comunitate materialele cu status `failed`. Pentru `ready_with_warnings`, publicarea poate fi permisa, dar cu avertisment si eventual review.

### Date necesare pentru comunitate

Extinderi probabile in schema:

- `visibility`: private / community / unlisted
- `published_at`
- `published_by`
- `community_scope_type`
- `community_scope_id` sau campuri explicite pentru institution/program/cohort/year/semester
- `source_study_set_id` pentru copii/private forks
- `community_usage_count`
- `community_average_score`
- `report_count`

Tabele suplimentare posibile:

- `learning_study_set_publications`
- `learning_study_set_reports`
- `learning_community_leaderboards`
- `learning_contributor_rewards`

### Analytics comunitate

Admin trebuie sa poata vedea:

- cate study sets sunt private vs publicate;
- cate materiale publicate sunt folosite de comunitate;
- cate incarcari duplicate au fost evitate;
- top materiale pe comunitate;
- top contributori;
- materiale raportate;
- scor mediu pe study set;
- capitole cu cele mai multe greseli la nivel de comunitate.

## Billing si produs

### Recomandare MVP

- 1 study set = 1 incarcare.
- limita de marime ramane cea curenta pana decidem altfel.
- daca documentul este foarte mare, procesam un subset si afisam avertisment.
- daca study set-ul este publicat in comunitate, ceilalti il folosesc fara incarcare suplimentara.
- daca alt utilizator face copie privata si cere reprocesare/regenerare, poate consuma o incarcare noua.

### De ce nu taxam pe fiecare mod

Flashcards, teste si planul folosesc date deja generate. Daca taxam fiecare mod, experienta devine stresanta si utilizatorul evita exact functiile care cresc retentia.

### Cand schimbam modelul

Doar dupa ce avem date:

- cost mediu per study set;
- rata de esec;
- rata de folosire dupa upload;
- raport intre incarcari cumparate si study sets procesate;
- cat de des oamenii folosesc `Complet` daca introducem niveluri.

## Roadmap pe faze

### Faza 0: plan si validare

Status: in lucru in acest document.

Livrabile:

- decizie UX;
- decizie cost;
- schema propusa;
- roadmap;
- criterii de succes.

### Faza 1: MVP functional

Include:

- schema Supabase;
- upload PDF/DOCX/text;
- pipeline standard;
- overview;
- capitole;
- flashcards;
- quiz;
- greseli;
- plan simplu;
- analytics basic.

Nu include obligatoriu:

- PPTX daca extractorul creste riscul;
- simulare examen mixta completa;
- plan adaptiv.

### Faza 2: imbunatatire invatare

Include:

- spaced repetition real;
- plan adaptiv;
- simulare examen mixta;
- regenerare pe capitol;
- recomandari mai bune dupa greseli.

### Faza 3: optimizare produs

Include:

- landing sau sectiune dedicata bazata pe analytics;
- pricing mai fin daca datele arata nevoie;
- dashboard admin cost/calitate;
- export/print recapitulare, daca utilizatorii cer.

## Ce exista deja si trebuie reutilizat

Surse active relevante:
- `app/ai/page.js` si ruta publica `/materiale`, care rescrie catre `/ai`
- `components/workspace-generate-form.js`
- `app/api/ai/*` si `app/api/materiale/*`
- `lib/ai/question-bank-pipeline.js`
- `lib/ai/import-pipeline.js`
- `lib/ai/extract-text.js`
- `lib/ai/upload-limits.js`
- `components/test-page-client.js`
- `components/study-page-client.js`
- `components/test-result-panel.js`
- `components/private-test-player.js`
- `supabase/migrations/`

Limitare curenta importanta:
- upload-ul accepta PDF, DOCX si TXT/text lipit.
- PowerPoint/PPTX nu este inca in `AI_SOURCE_ACCEPTED_MIME_TYPES`.

## Input-uri acceptate

MVP:
- PDF
- DOCX
- text lipit

PPTX:
- trebuie inclus in planul tehnic, dar poate fi livrat in acelasi MVP doar daca extragerea este stabila fara sa blocheze restul.
- daca adauga prea mult risc, il marcam vizibil ca "in curand" si il lansam imediat dupa MVP.
- cand il implementam, adaugam:
  - MIME type PPTX in `lib/ai/upload-limits.js`
  - extensia `.pptx` in uploader
  - extractor text pentru slide-uri
  - test cu prezentare simpla si prezentare cu multe bullet-uri

## Prima pagina a modulului

Ruta recomandata: `/materiale/invata`

Mesaj principal:

> Incarca materia ta si transform-o in teste, flashcards si plan de invatare.

Optiuni UI:
- Incarca PDF
- Incarca DOCX
- Lipeste text
- Incarca PowerPoint/PPTX

Campuri recomandate:
- Titlu materie
- Data examenului, optional
- Minute disponibile pe zi, optional
- Nivel actual: incepator / mediu / avansat / nu stiu
- Obiectiv: invatare rapida / examen grila / examen mixt / recapitulare

Regula UX:
- sa nu existe selectie default pentru campuri care pot influenta procesarea.
- daca un camp este optional, sa fie marcat clar optional.

## Dupa upload: analiza materiei

Dupa procesare, utilizatorul vede un ecran de rezultat:

Exemplu:
- Materia a fost analizata
- 128 pagini detectate
- 7 capitole identificate
- 42 concepte importante
- 120 intrebari generate
- 85 flashcards create
- Nivel estimat: mediu
- Timp recomandat de invatare: 5 zile

Acest ecran trebuie sa dea incredere. Dar valorile trebuie sa fie reale sau estimari marcate corect, nu numere inventate.

Campuri de salvat:
- page_count_estimate
- chapter_count
- concept_count
- generated_question_count
- flashcard_count
- estimated_level
- recommended_study_days
- processing_warnings

## Structura de date propusa

Adauga migrari noi, nu modifica migrari vechi.

Tabele propuse:

### `learning_study_sets`

Reprezinta materia incarcata.

Campuri:
- id
- user_id
- source_document_id
- title
- input_type: pdf / docx / txt / paste / pptx
- status: uploaded / extracting / analyzing / ready / failed
- page_count_estimate
- chapter_count
- concept_count
- question_count
- flashcard_count
- estimated_level
- recommended_study_days
- exam_date
- daily_minutes
- current_level
- objective
- metadata
- created_at
- updated_at

### `learning_chapters`

Capitolele detectate.

Campuri:
- id
- study_set_id
- user_id
- position
- title
- summary
- key_ideas jsonb
- key_terms jsonb
- source_start_hint
- source_end_hint
- metadata

### `learning_concepts`

Concepte importante extrase din materie.

Campuri:
- id
- study_set_id
- chapter_id
- user_id
- title
- simple_explanation
- example
- analogy
- check_question
- importance_score
- metadata

### `learning_flashcards`

Flashcards pentru invatare si repetitie.

Campuri:
- id
- study_set_id
- chapter_id
- concept_id
- user_id
- front
- back
- difficulty
- next_review_at
- review_interval_days
- ease_factor
- last_rating: unknown / hard / almost / known
- metadata

### `learning_questions`

Intrebari grila si deschise.

Campuri:
- id
- study_set_id
- chapter_id
- concept_id
- user_id
- question_type: multiple_choice / open / true_false / short_answer
- question_text
- options jsonb
- correct_answer
- explanation
- difficulty
- metadata

### `learning_attempts`

Incercari de test, flashcards si simulari.

Campuri:
- id
- study_set_id
- user_id
- mode: flashcards / chapter_test / quiz / exam_simulation / mistakes
- score
- total_items
- correct_items
- wrong_items
- duration_seconds
- metadata
- created_at

### `learning_attempt_items`

Raspunsurile individuale.

Campuri:
- id
- attempt_id
- study_set_id
- question_id
- flashcard_id
- user_id
- user_answer
- is_correct
- rating
- response_time_seconds
- metadata

## Procesare initiala recomandata

Pipeline:
1. Salveaza sursa incarcata sau textul lipit.
2. Extrage textul.
3. Normalizeaza textul si detecteaza structura.
4. Genereaza outline-ul pe capitole.
5. Pentru fiecare capitol genereaza:
   - rezumat scurt
   - idei importante
   - termeni-cheie
   - concepte
   - intrebari grila
   - intrebari deschise
   - flashcards
6. Ruleaza o etapa de consolidare:
   - elimina duplicate
   - verifica intrebari fara raspuns
   - leaga conceptele de capitole
   - calculeaza statistici
7. Publica `study_set` ca `ready`.

Regula pentru chunking:
- Chunking-ul trebuie facut astfel incat sa pastreze capitolele cat mai intregi.
- Daca o sectiune este rupta intre chunkuri, ultima bucata trebuie tratata ca fragment de continuare, nu ca element final.
- Aceasta lectie vine din problemele anterioare cu intrebari rupte intre chunkuri.

## Mod 1: Invata pe capitole

Pentru fiecare capitol afisam:
- rezumat scurt
- idei importante
- termeni-cheie
- concepte principale
- intrebari generate
- flashcards
- test de capitol

Actiuni:
- `Invata capitolul`
- `Flashcards`
- `Test de capitol`
- `Explica-mi conceptele`

MVP:
- lista capitole
- pagina capitol
- rezumat, idei, termeni
- buton test capitol

## Mod 2: Flashcards

Card fata:
- intrebare/concept

Card spate:
- raspuns/explicatie

Butoane:
- Nu stiu
- Aproape
- Stiu
- Repeta mai tarziu

Spaced repetition:
- `Nu stiu`: revine foarte curand
- `Aproape`: revine mai tarziu in sesiune sau maine
- `Stiu`: creste intervalul
- `Repeta mai tarziu`: ramane in coada zilei

MVP:
- sesiune flashcards
- salvare rating
- repetare carduri slabe in aceeasi sesiune

Faza urmatoare:
- algoritm complet de repetitie pe zile cu `next_review_at`.

## Mod 3: Test grila

Utilizatorul alege:
- numar intrebari: 10 / 20 / 30 / 50
- dificultate: usor / mediu / greu / mixt
- capitol: toate / capitole selectate
- explicatii imediat / explicatii la final
- timp limita: da / nu

Dupa test:
- scor
- intrebari gresite
- explicatie pentru fiecare raspuns
- recomandare de recapitulare
- buton `Genereaza test doar din greseli`

MVP:
- test grila pe toate capitolele sau pe un capitol
- scor
- greseli
- explicatii la final
- test din greseli

## Mod 4: Explica-mi simplu

Utilizatorul apasa pe un concept si primeste:
- explicatie simpla
- exemplu concret
- analogie
- intrebare de verificare

Exemplu:
- Concept: avantaj competitiv
- Explicatie simpla: motivul pentru care o firma este aleasa in locul alteia.
- Exemplu: pret mai mic, livrare mai rapida sau produse mai bune.

MVP:
- conceptele sunt generate la procesare si afisate in capitol.
- nu generam explicatii live la fiecare click daca avem deja date salvate.

## Mod 5: Simulare examen

Scop:
- test mai apropiat de un examen real, nu doar grila.

Structura posibila:
- partea 1: adevarat/fals sau intrebari usoare
- partea 2: grile medii
- partea 3: intrebari deschise/scurte
- partea 4: subiect teoretic sau aplicativ, daca materia permite

Reguli:
- dificultatea creste gradual.
- rezultatul separa scorul pe sectiuni.
- intrebarile deschise pot fi evaluate orientativ, cu mesaj clar ca necesita verificare cand raspunsul este ambiguu.

MVP:
- simulare mixta cu grila + adevarat/fals + intrebari scurte.
- evaluare automata doar pentru grila/adevarat-fals.
- raspunsurile deschise primesc model de raspuns si auto-check simplu.

## Mod 6: Invata din greseli

Dupa fiecare test, salvam:
- intrebari gresite
- concepte legate de greseli
- explicatii afisate
- capitole slabe

Buton:
- `Repeta ce ai gresit`

Include:
- intrebarile gresite
- explicatiile
- flashcards din conceptele gresite
- mini-test de recuperare

MVP:
- colectam greselile din test.
- afisam o sesiune cu intrebari gresite.
- recomandam capitolul/conceptul slab.

## Mod 7: Plan de invatare automat

Input:
- data examenului
- minute disponibile pe zi
- nivel actual
- materia incarcata

Output:
- plan pe zile

Exemplu:
- Ziua 1: Capitolul 1, 20 flashcards, test 10 intrebari
- Ziua 2: Capitolul 2, recapitulare Capitolul 1, test mixt
- Ziua 3: intrebari gresite, simulare scurta

MVP:
- plan simplu bazat pe numar capitole, zile ramase si minute pe zi.
- planul foloseste activitati existente, nu genereaza continut nou.

Faza urmatoare:
- plan adaptiv care se schimba dupa scoruri si flashcards gresite.

## Ce NU facem in MVP

Pentru a nu face lucruri degeaba:
- nu facem landing page separat inainte sa avem flow-ul functional.
- nu facem chat general peste materie.
- nu facem evaluare perfecta pentru eseuri/deschise in prima versiune.
- nu facem spaced repetition complex inainte sa existe sesiunea de flashcards.
- nu generam continut diferit pentru fiecare mod; toate modurile folosesc acelasi `study_set`.
- nu ascundem faptul ca unele intrebari/raspunsuri pot necesita verificare.

## MVP recomandat

MVP-ul care merita implementat primul:

1. Ruta `/materiale/invata`
2. Upload PDF/DOCX/TXT/text lipit
3. Procesare in `learning_study_sets`
4. Analiza dupa upload:
   - pagini estimate
   - capitole
   - concepte
   - intrebari
   - flashcards
   - timp recomandat
5. Pagina study set:
   - overview
   - capitole
   - flashcards
   - test grila
   - greseli
   - plan de invatare
6. Invata pe capitole
7. Flashcards simple cu rating
8. Test grila cu rezultate si explicatii
9. Invata din greseli
10. Plan simplu de invatare

PPTX poate intra in MVP daca extractorul este stabil rapid; altfel devine primul task dupa MVP.

## UX si navigatie

Workspace `/materiale`:
- card principal nou: `Invata din materia ta`
- card existent: `Incarca intrebari si raspunsuri`
- card licenta: `Construieste licenta`

Pagina `/materiale/invata`:
- fara texte lungi de marketing.
- uploadul este prima actiune vizibila.
- copy scurt si clar.

Pagina `/materiale/invata/[studySetId]`:
- taburi:
  - Overview
  - Capitole
  - Flashcards
  - Test
  - Greseli
  - Plan

Mobile:
- taburile devin chips scrollabile sau bottom action sections.
- testul si flashcards trebuie sa fie usable pe telefon.

## Admin si analytics

In Admin Analytics ar trebui sa putem vedea:
- cate study sets sunt create
- cate ajung `ready`
- cate pica la procesare
- cele mai folosite moduri: capitole / flashcards / test / greseli / plan
- medie flashcards per set
- medie intrebari per set
- rata de folosire dupa upload: utilizatorul chiar invata sau doar incarca?

Evenimente usage recomandate:
- `learning_upload_started`
- `learning_upload_completed`
- `learning_set_ready`
- `learning_chapter_opened`
- `learning_flashcards_started`
- `learning_quiz_started`
- `learning_quiz_completed`
- `learning_mistakes_started`
- `learning_plan_created`

## Billing / consum incarcari

Decizie de luat in implementare:
- o materie procesata consuma o incarcare?
- sau consuma mai multe in functie de marime?

Recomandare initiala:
- 1 upload = 1 study set pana la limita curenta de marime.
- daca procesarea va genera mult mai mult continut decat importul de grile, putem introduce plan diferit mai tarziu.

Important:
- nu mentiona "AI", "OpenAI" sau "credite AI" in UI final.
- foloseste "incarcari", "procesare", "materiale", "Workspace".

## Riscuri tehnice

1. Cost si timp de procesare
   - generarea capitolelor, flashcards si intrebarilor poate fi mai scumpa decat importul de grile.
   - mitigare: procesare pe capitole si salvare partiala.

2. Documente lungi
   - trebuie procesare pe bucati, dar fara sa rupa capitolele aiurea.
   - mitigare: detectare outline inainte de generare pe capitole.

3. Continut de calitate slaba
   - materiale scanate prost, text dezordonat, slide-uri fara context.
   - mitigare: status `needs_review` si avertismente clare.

4. Intrebari deschise
   - evaluarea poate fi discutabila.
   - mitigare: in MVP oferim model de raspuns si auto-check orientativ.

5. Dubluri
   - acelasi concept poate aparea in mai multe capitole.
   - mitigare: consolidare dupa generare.

## Metrici de produs

### Metrici de adoptie

- cati utilizatori deschid `/materiale/invata`;
- cati incep uploadul;
- cati finalizeaza uploadul;
- cati ajung la study set `ready`;
- cati deschid study set-ul dupa procesare.
- cati publica study set-ul in comunitate;
- cati folosesc un study set publicat de alt coleg.

### Metrici de invatare

- cate sesiuni de flashcards per study set;
- cate teste per study set;
- rata de finalizare test;
- scor mediu initial;
- scor mediu dupa repetarea greselilor;
- cate greseli sunt repetate;
- cate capitole sunt marcate ca parcurse.

### Metrici de calitate

- rata `ready`;
- rata `ready_with_warnings`;
- rata `failed`;
- capitole medii per material;
- flashcards medii per capitol;
- intrebari medii per capitol;
- procent capitole fara suficiente intrebari;
- procent intrebari cu confidence scazut.

### Metrici de cost

- durata medie procesare;
- cost estimat per study set;
- cost estimat per capitol;
- cost estimat per utilizator activ;
- cost pierdut pe joburi esuate;
- cost pentru documente care nu sunt folosite dupa procesare;
- incarcari duplicate evitate prin reutilizare comunitara.

Metricile de cost trebuie legate de usage. Un study set scump poate fi acceptabil daca utilizatorul chiar invata din el.

## Decizii deschise inainte de implementare

Aceste decizii trebuie confirmate explicit inainte sa scriem codul principal.

| Decizie | Recomandare curenta | Motiv | Status |
| --- | --- | --- | --- |
| Landing separat | Nu la inceput | Workspace exista deja si flow-ul trebuie validat intai | Deschis |
| Ruta principala | `/materiale/invata` | Pastreaza totul in Workspace | Deschis |
| PPTX in MVP | Doar daca extractorul este rapid/stabil | Poate creste riscul tehnic | Deschis |
| Billing | 1 study set = 1 incarcare | Simplu si usor de inteles | Deschis |
| Study set privat sau comunitar | Privat la procesare, publicabil manual in comunitate | Reduce duplicatele fara sa publice accidental continut personal | Deschis |
| Cost pentru colegi | Study set publicat se foloseste fara incarcare suplimentara | Incurajeaza contributia si reduce procesari duplicate | Deschis |
| Leaderboard | MVP simplu pe study set, apoi comunitate completa | Competitia ajuta retentia, dar trebuie privacy/control | Deschis |
| Simulare examen mixta | Faza 2 daca MVP devine mare | Nu trebuie sa blocheze invatarea de baza | Deschis |
| Plan adaptiv | Faza 2 | Are nevoie de date din teste/flashcards | Deschis |
| Niveluri Rapid/Complet | Nu in MVP | Mai putine alegeri initiale | Deschis |

## Decizii deja recomandate

- nu folosim un chat ca baza modulului;
- nu generam continut separat pentru fiecare mod;
- nu expunem termeni tehnici in UI;
- salvam rezultatele si le reutilizam;
- study set-ul poate deveni activ comunitar prin publicare explicita, nu automat;
- colegii din comunitatea potrivita pot folosi un study set publicat fara incarcare noua;
- folosim status asincron si activitate recenta;
- Admin trebuie sa vada atat usage, cat si esecuri/costuri.

## Plan UI/UX concret pentru implementare

### Workspace hub wireframe textual

Ordine recomandata pe pagina:

1. Header Workspace
   - titlu orientat pe actiune;
   - link `Vezi activitatea`.
2. Carduri de decizie:
   - `Invata din materia ta` - principal;
   - `Importa intrebari existente`;
   - `Pregateste licenta`.
3. Sumar cont:
   - incarcari disponibile;
   - comunitatea activa.
4. Activitate recenta.

Cardul `Invata din materia ta`:

- icon: carte/fisier;
- titlu;
- 1 propozitie;
- 3 bullets mici: `Capitole`, `Flashcards`, `Plan`;
- CTA principal: `Incarca materia`.

### Upload wireframe textual

Ordine:

1. Titlu si microcopy.
2. Dropzone/upload.
3. Alternativa `Lipeste text`.
4. Detalii optionale intr-o zona secundara.
5. Cost/consum.
6. CTA `Proceseaza materia`.

Nu se pune in primul ecran:

- lista lunga cu toate modurile;
- explicatii despre cum functioneaza procesarea;
- setari avansate de generare.

### Study set overview wireframe textual

Ordine:

1. Status si titlu materie.
2. CTA principal `Continua invatarea`.
3. KPI-uri: capitole, flashcards, intrebari, timp recomandat.
4. Recomandare urmatoare.
5. Taburi.
6. Activitate recenta in acest study set.

### Flashcards wireframe textual

Ordine:

1. Header compact cu progres.
2. Card central.
3. Actiuni de rating.
4. Rezumat la final.

Pe mobil:

- cardul ocupa latimea utila;
- butoanele sunt mari;
- nu avem toolbar aglomerat.

### Test wireframe textual

Ordine:

1. Alegere rapida:
   - `Test rapid`
   - `Personalizeaza`
2. Daca personalizat:
   - numar intrebari;
   - capitole;
   - dificultate;
   - explicatii;
   - timp.
3. Test.
4. Rezultat.
5. Actiuni pe greseli.

## Content strategy

### Copy recomandat

Workspace card:

> Incarca materia ta si primesti capitole, flashcards, teste si un plan de invatare.

Upload:

> Pune aici cursul, notitele sau prezentarea. Dupa procesare, iti aratam ce capitole am gasit si de unde sa incepi.

Procesare:

> Pregatim materialele de invatare. Poti reveni oricand din activitate.

Ready:

> Materia este gata de invatat.

Warnings:

> Am pregatit materialul, dar unele zone pot avea nevoie de verificare.

### Copy de evitat

- "AI-ul analizeaza"
- "OpenAI proceseaza"
- "credite AI"
- "prompt"
- "chunk"
- "schema"
- "baza de date"

## QA matrix

### Documente de test

Trebuie pregatite local sau in storage:

- PDF text selectabil scurt, 3-5 pagini;
- PDF lung, 80+ pagini;
- DOCX cu titluri clare;
- DOCX copiat din PDF, cu formatting slab;
- TXT sau text lipit simplu;
- material fara capitole clare;
- material prea scurt;
- PPTX simplu, daca intra in MVP;
- PPTX cu slide-uri multe si bullet-uri, daca intra in MVP.

### Scenarii functionale

- upload reusit;
- upload fara incarcari disponibile;
- refresh in timpul procesarii;
- revenire din activitate;
- job esuat;
- job partial cu warnings;
- study set ready;
- flashcards rating;
- quiz finalizat;
- repetare greseli;
- plan generat;
- mobile layout.

### Scenarii negative

- fisier prea mare;
- format neacceptat;
- text lipit prea scurt;
- document fara text util;
- procesare intrerupta;
- utilizator nelogat;
- setup Supabase incomplet;
- storage indisponibil.

## Observabilitate si debugging

Pentru fiecare job trebuie sa putem vedea in Admin/loguri:

- study_set_id;
- user_id;
- source_document_id;
- stage curent;
- durata pe etapa;
- numar capitole detectate;
- numar capitole generate;
- warnings;
- eroare user-friendly;
- eroare tehnica scurta;
- cost estimat, daca exista.

Nu logam:

- document complet;
- chei;
- date sensibile inutile.

## Acceptanta inainte de implementare

Planul este gata de implementare doar cand:

- deciziile deschise sunt confirmate;
- MVP-ul este acceptat ca scope;
- schema este suficient de clara pentru migrari;
- UI-ul are rute si ecrane clare;
- cost strategy este acceptata;
- QA matrix este acceptata;
- avem criterii clare pentru "gata".

## Checklist implementare

### Documentare si decizie

- [x] Document de plan creat: `docs/material-learning-module-plan.md`
- [x] Plan extins cu UX, cost, optimizare, QA si roadmap
- [ ] Decizie finala confirmata: integrat in Workspace, nu landing separat initial
- [ ] Decizie finala PPTX: MVP sau imediat dupa MVP
- [ ] Decizie finala billing pentru study set
- [ ] Decizie finala privacy/comunitate: privat initial, publicabil manual in comunitate
- [ ] Decizie finala acces comunitate: cine vede materialul publicat
- [ ] Decizie finala leaderboard: anonim, nume real sau opt-in
- [ ] Decizie finala simulare mixta: MVP sau faza 2

### Schema Supabase

- [ ] Migrare `learning_study_sets`
- [ ] Migrare `learning_chapters`
- [ ] Migrare `learning_concepts`
- [ ] Migrare `learning_flashcards`
- [ ] Migrare `learning_questions`
- [ ] Migrare `learning_attempts`
- [ ] Migrare `learning_attempt_items`
- [ ] Campuri/tabele pentru publicare comunitara
- [ ] Campuri/tabele pentru raportare materiale
- [ ] Campuri/tabele pentru leaderboard/reputatie daca intra in MVP
- [ ] RLS pentru toate tabelele
- [ ] Indexuri pentru user, study_set, status, next_review_at
- [ ] Indexuri pentru community scope si materiale publicate

### Backend

- [ ] API upload/creare study set
- [ ] Idempotency pentru submit/upload
- [ ] Extractie text PDF
- [ ] Extractie text DOCX
- [ ] Extractie text lipit
- [ ] Extractie PPTX daca intra in MVP
- [ ] Pipeline analiza materie
- [ ] Pipeline generare capitole
- [ ] Pipeline generare concepte
- [ ] Pipeline generare flashcards
- [ ] Pipeline generare intrebari
- [ ] Consolidare si deduplicare
- [ ] Status/progress pentru procesare
- [ ] Salvare partiala pe capitole
- [ ] Retry doar pentru capitole esuate
- [ ] Publicare manuala in comunitate
- [ ] Folosire study set publicat fara consum de incarcare
- [ ] Raportare/depublicare material comunitar
- [ ] Fallback pentru setup Supabase incomplet

### UI

- [ ] Workspace hub cu 3 optiuni clare
- [ ] Card nou in Workspace pentru `Invata din materia ta`
- [ ] Ruta `/materiale/invata`
- [ ] Upload simplu PDF/DOCX/text/PPTX
- [ ] Ecran de procesare
- [ ] Ecran analiza materie
- [ ] Ruta `/materiale/invata/[studySetId]`
- [ ] Overview study set
- [ ] Tab capitole
- [ ] Pagina/sectiune capitol
- [ ] Tab flashcards
- [ ] Tab test
- [ ] Tab greseli
- [ ] Tab plan
- [ ] Actiune `Publica pentru clasa/grupa ta`
- [ ] Lista `Materiale din comunitatea ta`
- [ ] Indicator `Publicat in comunitate`
- [ ] Leaderboard simplu pe study set daca intra in MVP
- [ ] Empty/loading/error states
- [ ] Mobile layout verificat
- [ ] Copy fara termeni tehnici interzisi

### Moduri invatare

- [ ] Invata pe capitole
- [ ] Flashcards cu rating
- [ ] Test grila configurabil
- [ ] Rezultate cu explicatii
- [ ] Test din greseli
- [ ] Explica-mi simplu pentru concepte
- [ ] Simulare examen mixta
- [ ] Plan de invatare simplu

### Analytics/Admin

- [ ] Usage events pentru flow-ul de invatare
- [ ] Cost estimat per study set in Admin
- [ ] Durata pe etapa in Admin/loguri
- [ ] Admin vede study sets create
- [ ] Admin vede rate de reusita/esec
- [ ] Admin vede modurile folosite cel mai mult
- [ ] Admin vede erori de procesare pentru study sets
- [ ] Admin vede study sets scumpe dar nefolosite dupa procesare
- [ ] Admin vede materiale publicate in comunitate
- [ ] Admin vede materiale raportate
- [ ] Admin vede incarcari duplicate evitate prin comunitate
- [ ] Admin vede top materiale si top contributori

### Verificare

- [ ] `npm run build`
- [ ] `npm run supabase:check`
- [ ] Migrare aplicata live
- [ ] Test upload text scurt
- [ ] Test upload DOCX
- [ ] Test upload PDF
- [ ] Test upload PPTX daca intra in MVP
- [ ] Test flashcards
- [ ] Test quiz
- [ ] Test greseli
- [ ] Test plan
- [ ] Verificare vizuala desktop
- [ ] Verificare vizuala mobile

## Ordine recomandata de implementare

1. Schema + modele server-side.
2. Ruta `/materiale/invata` cu upload simplu.
3. Pipeline minim care produce capitole, rezumat, flashcards si grile.
4. Pagina rezultat/overview.
5. Capitole + flashcards.
6. Test grila + rezultate.
7. Greseli.
8. Plan de invatare.
9. Analytics admin.
10. Sectiune pe landing-ul public actual.
11. PPTX, daca nu a intrat in MVP.
12. Simulare examen mixta.

## Criteriu de succes

Modulul este considerat implementat cand un utilizator poate:
1. intra in Workspace;
2. alege `Invata din materia ta`;
3. incarca PDF/DOCX/text sau PPTX daca este inclus in MVP;
4. vede analiza materiei;
5. intra pe capitole;
6. foloseste flashcards;
7. da un test;
8. vede greselile si explicatiile;
9. repeta greselile;
10. primeste un plan de invatare;
11. iar Admin poate vedea usage si erori pentru acest flow.
