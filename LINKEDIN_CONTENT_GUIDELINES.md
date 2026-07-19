# LinkedIn Content Guidelines

## Standard editorial

O postare bună dezvoltă o singură idee care poate fi demonstrată din articol. Primele două rânduri trebuie să promită exact ce livrează restul textului. Corpul explică problema, tensiunea și implicația în paragrafe ușor de scanat pe telefon. CTA-ul apare numai când oferă cititorului o acțiune naturală.

Generatorul nu inventează experiențe personale, opinii ale autorului, clienți, proiecte, cifre, citate, rezultate sau predicții. Pentru orice afirmație factuală, sursa de adevăr este articolul publicat. Ambiguitățile rămân ambiguități: un proiect de regulament nu devine regulament aprobat, iar o asociere statistică nu devine cauzalitate.

## Hook

Hook-ul trebuie să fie specific, credibil și legat direct de unghi. Sunt potrivite o consecință concretă, o contradicție reală, o greșeală observabilă, o întrebare precisă sau o schimbare de perspectivă susținută de articol.

Evită promisiunile absolute, dramatizarea și „curiosity gap”-ul care ascunde intenționat informația. Nu folosi formule precum „viitorul este deja aici”, „schimbă totul”, „game changer” sau „este mai important ca niciodată”.

## Structură și stil

- Păstrează o singură idee centrală.
- Folosește paragrafe scurte, nu câte un rând pentru fiecare propoziție.
- Evită opozițiile mecanice de tip „nu este X, este Y”, listele de trei idei fără legătură și fragmentele scrise numai pentru efect.
- Nu deschide cu context generic despre „lumea dinamică de astăzi”.
- Nu repeta concluzia în hook, corp și CTA.
- Folosește 0–4 hashtaguri specifice, așezate o singură dată la final.
- Nu cere generic like-uri, distribuiri sau „păreri”.
- Nu introduce emoji decorative.

## CTA și link

CTA-ul poate invita la un comentariu specific, accesarea articolului, salvare, distribuire către o echipă, mesaj sau testarea produsului. Poate lipsi complet dacă ideea are deja o încheiere puternică.

Linkul are patru moduri: inclus natural, la final, în primul comentariu sau absent. Serverul compune forma finală, astfel încât URL-ul și hashtagurile să nu fie duplicate. Dacă primul comentariu nu poate fi confirmat, postarea publicată nu este duplicată; comentariul primește o stare separată și poate fi reluat numai când rezultatul nu este ambiguu.

## Procesul de generare

Versiunea `linkedin-post-generator-v2` folosește trei cereri structurate:

1. Analizează articolul, produce trei unghiuri și cinci hook-uri evaluate, apoi alege câte unul.
2. Redactează o ciornă structurată pe baza strategiei și a dovezilor.
3. Acordă scoruri pe 12 criterii, identifică problemele și livrează varianta finală revizuită.

După aceste etape, validarea locală verifică schema, limita de 3.000 de caractere, URL-ul, hashtagurile, expresiile interzise și afirmațiile factuale. Promptul, opțiunile, analiza, variantele, critica, scorul și istoricul rafinărilor sunt păstrate pentru audit.

## Exemple

Slab: „Viitorul educației este deja aici. Această soluție revoluționară schimbă totul.”

Bun: „Un procent de promovare nu spune nimic până nu afli cine intră în numitor.”

Slab: „Nu este despre tehnologie. Este despre oameni. Tu ce părere ai?”

Bun: „Facultatea a redus timpul median de așteptare de la 47 la 14 minute. Formularul online a fost doar jumătate din decizie.”

## Revizuire înainte de publicare

Administratorul verifică dacă hook-ul este demonstrat, textul păstrează nuanțele articolului, afirmațiile personale sunt reale, CTA-ul este firesc și previzualizarea nu depășește limita LinkedIn. Scorul este un instrument de prioritizare, nu înlocuiește aprobarea editorială.

## Evaluare și îmbunătățire

Fixture-urile din `tests/fixtures/linkedin-articles.mjs` acoperă știri din educație, tehnologie, explicații educaționale, studiu de caz, promovare, date statistice, articole fără unghi evident, foarte lungi, foarte scurte și ambigue. Feedbackul pozitiv sau negativ este salvat pe variantă pentru analiză ulterioară; nu modifică automat prompturile în producție.
