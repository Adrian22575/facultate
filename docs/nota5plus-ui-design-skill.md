# Nota 5+ UI Design Skill

Acest document este skill-ul intern permanent pentru design-ul UI din aplicatia `Nota 5+`.
Orice pagina sau componenta noua trebuie sa respecte acest skill, fara sa fie nevoie sa repeti cerintele.

## 1. Identitate produs

- Nume produs: `Nota 5+`
- Pozitionare: platforma pentru studenti si elevi care repeta rapid pentru examene, licenta, restante si teste.
- Principiu: produs modern, simplu, premium; fara aspect de proiect static sau interfata tehnica.

## 2. Ton UX

Ton obligatoriu:
- clar
- direct
- orientat pe actiune
- scurt
- fara jargon tehnic

Focus de copy:
- examen aproape
- timp putin
- nevoie de recapitulare rapida
- mai putin haos

Formulari recomandate:
- `Pregatire rapida`
- `Continua de unde ai ramas`
- `Teste pe materii`
- `Simulare examen licenta`
- `Progresul tau`
- `Intrebari gresite`
- `Recapitulare`
- `Fara pasi inutili`

Nu promite agresiv rezultate garantate.

## 3. Termeni interzisi in UI

Termenii de mai jos pot exista in cod, dar NU se afiseaza utilizatorului final:
- `AI`
- `credite AI`
- `OpenAI`
- `Supabase`
- `Stripe`
- `setup`
- `database`
- `billing`
- `SaaS`
- `demo tehnic`
- `migratii`
- `webhook`
- `API key`

## 4. Sistem vizual

### Paleta

- albastru principal: `#1250b1`
- albastru inchis: `#0b367d`
- albastru soft: `#eaf2ff`
- text principal: `#14213d`
- text secundar: `#60708d`
- border: `#dbe5f2`
- fundal: `#f5f8fd`
- alb: `#ffffff`
- verde accent: `#1f9d63`
- portocaliu accent discret: `#ffb020`

### Tipografie

- Se pastreaza fontul global actual al aplicatiei
- Nu se adauga un font separat doar pentru branding, landing sau cont
- weights:
  - `400/500` text normal si descrieri
  - `600` microcopy important si texte comparative
  - `700` titluri scurte, labels, badge-uri
  - `900` doar pentru headline major, preturi si CTA principal

Regula practica:
- daca un element nu conduce conversia sau nu clarifica informatia principala, nu trebuie sa para tipografic mai puternic decat titlul sau pretul

### Fundal aplicatie

```css
background:
  radial-gradient(circle at top left, rgba(18, 80, 177, 0.10), transparent 28%),
  radial-gradient(circle at top right, rgba(255, 176, 32, 0.10), transparent 24%),
  linear-gradient(180deg, #f8fbff 0%, #eef4fb 100%);
```

### Layout

- `max-width: 1180px`
- pagini centrate
- padding general: `28px 20px 50px`
- pe mobil: `18px 14px 34px`
- grid pe desktop, o singura coloana pe mobil
- evita pagini inguste pentru dashboard sau cont
- carduri mari, aerisite

### Radius

- carduri mari: `26px-30px`
- carduri mici: `18px-22px`
- butoane: `14px-18px`
- logo mark: `16px`
- pills si badges: `999px`

### Umbre

- card mare: `0 24px 70px rgba(20, 50, 100, 0.12)`
- card normal: `0 14px 32px rgba(20, 50, 100, 0.07)`
- buton principal: `0 16px 30px rgba(18, 80, 177, 0.22)`

## 5. Primitive UI de baza

Primitivele comune trebuie definite in `app/globals.css` si refolosite de paginile noi:
- `ui-panel-card`: card luminos de baza
- `ui-dark-cta-panel`: card inchis pentru CTA major
- `ui-icon-box`: icon box rotunjit cu accent albastru
- `ui-chip`: badge sau status chip
- `ui-section-label`: label de sectiune
- `ui-section-head`: head pentru titlu + descriere
- `ui-segmented-tabs` si `ui-segmented-tab`: tabs de tip pill
- `ui-price-card`: card de pricing
- `ui-actions-row`: bara de actiuni rapide

Regula:
- clasele noi trebuie sa fie generice, nu legate de o singura pagina
- clasele vechi pot ramane pentru compatibilitate, dar implementarea noua trebuie sa prefere baza comuna

## 6. Header / Navigare

Structura recomandata:
- stanga: logo `Nota 5+`
- logo mark: patrat rotunjit cu gradient albastru + text `5+`
- dreapta:
  - user logat: `Contul meu` si `Logout`
  - user nelogat: `Continua cu Google`

Reguli:
- nu aglomera header-ul cu informatii secundare
- foloseste pills sau badge-uri in continutul paginii, nu in header, daca informatia nu este esentiala global

## 7. Pagini publice vs pagini private

Pagini publice:
- pot fi mai editoriale si mai expresive
- hero mare, mockup, proof, comunitate, CTA dominant

Pagini private:
- raman mai functionale si mai sobre
- pot folosi summary cards, quick actions si pricing sections
- nu trebuie sa para admin generic
- nu trebuie sa copieze mecanic landing page-ul

## 8. Pricing

Terminologie:
- `Acces`
- `Materiale incarcate`
- `Incarcari de materiale`

Planuri standard:
- `Acces 24 ore: 10 lei`
- `Acces 7 zile: 25 lei`
- `Acces 30 zile: 49 lei`
- `1 material incarcat: 10 lei`
- `5 materiale incarcate: 25 lei`

Reguli de prezentare:
- numele planului, contextul si pretul trebuie sa fie imediat vizibile
- cardul recomandat poate avea badge discret `Recomandat`
- textele comparative stau direct in card daca ajuta decizia
- exemple bune:
  - `Mai putin decat o cafea.`
  - `Cat 2 drumuri cu metroul pana la facultate si inapoi.`
  - `Mai ieftin pe zi decat un snack rapid din campus.`

## 9. Reguli generale

- nu repeta aceeasi idee in mai multe carduri
- evita paragrafe lungi in hero
- actiunea principala trebuie sa fie imediat vizibila
- fiecare card are titlu + text scurt + CTA clar, daca are nevoie de CTA
- pe mobil: o singura coloana pentru zonele principale
- evita complet textul tehnic
- pastreaza brandingul `Nota 5+`
- mentine stil premium, albastru, aerisit, cu carduri rotunjite
- evita bold-ul excesiv pe pills, labels, descrieri si microcopy

## 10. Referinte de implementare

Implementarile de referinta pentru noua baza vizuala sunt:
- `app/auth/login/page.js`
- `app/cont/page.js`

Acestea stabilesc:
- landing-ul public
- pricing cards cu comparative copy
- section labels si pills
- cardurile de rezumat private
- dark CTA block pentru workspace sau continuare

## 11. Tabele admin / backoffice

Pentru liste administrative mari, patternul implicit este `tabel`, nu carduri in carduri.

Reguli obligatorii:
- fiecare tabel mare porneste cu paginare implicita de `10 randuri`
- fiecare tab admin cu lista mare trebuie sa aiba `search` si filtre locale
- daca o sectiune admin traieste deja intr-un card principal, nu adauga inca un card mare doar pentru titlu + subtitlu + tabel
- evita compozitia `surface > card > table wrapper` cand acelasi continut poate fi afisat mai curat intr-un singur strat
- separa semantic:
  - `primary action`
  - `secondary action`
  - `text action`
- pentru backoffice, viteza de scanare si densitatea buna au prioritate fata de decor

## 12. Regula de fallback pentru cerinte noi

Daca apare o cerinta noua care intra in conflict cu acest skill:
- se pastreaza functionalitatea ceruta
- se adapteaza vizual la stilul `Nota 5+`
- se evita revenirea la UI tehnic sau generic
