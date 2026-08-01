# Audit și plan de migrare pentru `app/globals.css`

## Verdict

`globals.css` nu mai este un fișier global în sens arhitectural. Este un repository secundar în interiorul repository-ului: conține foundations, shell, navigație, primitive, componente, pagini, responsive și patch-uri de compatibilitate.

Nu trebuie rescris sau împărțit mecanic într-un singur task. Cascada actuală depinde de ordine, iar mutarea regulilor după prefix ar putea schimba rezultatul vizual.

## Măsurători ale fișierului analizat

- aproximativ 26.900 de linii;
- aproximativ 595 KB necomprimat;
- aproximativ 87 KB comprimat gzip;
- 90 de blocuri `@media`;
- 88 de utilizări `!important`;
- peste 2.000 de declarații brute de `margin`, `padding` sau `gap` cu valori în pixeli;
- peste 1.000 de selectori apar în mai multe blocuri;
- peste 4.400 de selectori unici aproximativi.

Aceste valori nu demonstrează singure un defect, dar împreună cu structura fișierului indică o dependență ridicată de ordine și override-uri.

## Probleme confirmate

### 1. Selectori globali prea largi

Regulile pentru `button`, `button:not([class])`, `.btn-back`, `.btn-link` și alte roluri sunt grupate și primesc implicit aspect de acțiune primară.

Efecte:

- un buton fără clasă poate deveni CTA albastru;
- o acțiune textuală poate moșteni hover și transform;
- componente locale trebuie să neutralizeze stilurile globale;
- apar `!important` și selectori din ce în ce mai specifici.

### 2. Primitive și pagini sunt amestecate

După comentariul „UI base primitives” apar imediat:

- route loading;
- pagina publică;
- layout-uri și componente specifice paginilor.

Asta arată că secțiunea nu este un strat real de primitive.

### 3. Cascada este folosită drept mecanism de arhitectură

Fișierul conține comentarii care cer ca anumite reguli responsive să rămână ultimele pentru a nu fi suprascrise.

Când poziția în fișier este contractul principal, orice inserare poate produce regresii.

### 4. Stiluri de rută sunt globale

Prefixuri cu volum mare includ:

- `admin-linkedin-*`;
- `ai-workspace-*`;
- `admin-dictionary-*`;
- `admin-article-*`;
- `learning-upload-*`;
- `account-referral-*`;
- `licenta-prep-*`;
- `public-home-*`;
- `email-auth-*`;
- `billing-success-*`.

Acestea nu trebuie să fie încărcate și disponibile ca reguli globale pentru orice componentă.

### 5. Markerul de spacing trebuie verificat

`DESIGN-SPACING-GUARD` este ultima linie a fișierului. Din fișier singur nu rezultă ce verifică scriptul, deoarece nu există CSS după marker.

Trebuie inspectat scriptul asociat comenzii `npm run design:check` înainte de mutarea markerului sau schimbarea regulii.

## Ce este corect din recomandarea Gemini

- fișierul este greu de întreținut;
- conflictele și suprascrierile sunt un risc real;
- modificările concurente vor produce conflicte Git;
- stilurile specifice componentelor trebuie colocate;
- modularizarea este necesară.

## Ce trebuie corectat din recomandarea Gemini

### Performanța

Numărul de linii nu demonstrează singur o problemă de performanță.

Trebuie măsurată ieșirea buildului:

- dimensiunea CSS livrată;
- CSS nefolosit pe fiecare rută;
- timpul de parse și recalculate style;
- efectul cache-ului și al chunking-ului.

Fișierul actual este suficient de mare încât măsurarea este justificată, dar mentenanța și conflictele sunt deja probleme demonstrate.

### „Specificitate scăzută”

Problema nu este specificitatea scăzută. Problema este combinația dintre:

- selectori globali largi;
- specificitate inconsistentă;
- override-uri târzii;
- `!important`;
- dependență de ordinea regulilor.

### Sass sau Less

Nu este necesar să introducem Sass sau Less.

Un preprocesor poate împărți fișierele, dar nu rezolvă:

- stilurile globale prea largi;
- semantică neclară;
- componente care se suprascriu;
- CSS nefolosit pe rute.

Pentru Next.js, direcția recomandată este:

- global CSS numai pentru reguli cu adevărat globale;
- CSS Modules pentru stiluri specifice componentelor și paginilor;
- primitive globale puține și semantice.

### BEM

BEM este opțional. Proiectul are deja multe prefixuri.

Problema nu este lipsa unor nume lungi, ci faptul că toate clasele trăiesc în același scope și sunt redefinite în timp.

## Arhitectura țintă

```text
app/
  globals.css
  styles/
    foundations/
      tokens.css
      reset.css
      accessibility.css
      typography.css
    shell/
      app-shell.css
      navigation.css
    primitives/
      actions.css
      forms.css
      status.css
      surfaces.css
    patterns/
      toolbar.css
      table.css
      dialog.css
      empty-state.css
```

În `globals.css` rămân numai importurile globale și, temporar, stratul legacy care nu a fost încă migrat.

Stilurile specifice se mută lângă componente:

```text
components/
  app-header.js
  app-header.module.css

app/
  ai/
    page.js
    ai-workspace.module.css
  admin/
    page.js
    admin.module.css
  cont/
    page.js
    account.module.css
```

Numele exacte se adaptează componentelor reale. Nu se creează automat un singur CSS Module gigantic pentru fiecare rută.

## Ordinea sigură de migrare

### Faza 0 — Baseline

Înainte de mutări:

1. rulează buildul;
2. capturează paginile reprezentative la dimensiunile aprobate;
3. salvează lista de erori și warnings;
4. măsoară CSS-ul rezultat în build;
5. nu combina această etapă cu redesign.

### Faza 1 — Înghețarea fișierului global

- nu mai adăuga stiluri de rută în `globals.css`;
- stilurile noi specifice componentelor intră în CSS Modules;
- excepțiile trebuie documentate;
- verifică scriptul `design:check` și markerul.

### Faza 2 — Foundations

Extrage fără schimbare vizuală:

- `:root`;
- reset;
- body;
- font inheritance;
- focus;
- `.sr-only`;
- accesibilitate.

Păstrează ordinea importurilor.

### Faza 3 — Shell și navigare

Extrage:

- `.app-shell`;
- header;
- sidebar;
- mobile navigation;
- global feedback;
- skip link.

Această etapă necesită `layout.js`, `app-header.js` și componentele de navigare.

### Faza 4 — Acțiuni

Aceasta este cea mai importantă corecție semantică.

Înlocuiește treptat selectorii largi cu roluri explicite:

```text
.ui-action-primary
.ui-action-secondary
.ui-action-text
.ui-action-destructive
.ui-icon-button
```

Nu face o înlocuire globală automată. Migrează flux cu flux și verifică toate stările.

### Faza 5 — Formulare și statusuri

Extrage primitivele demonstrate:

- input;
- select;
- textarea;
- label;
- field error;
- status badge;
- alert;
- loading indicator.

### Faza 6 — Patternuri comune

Extrage numai patternuri folosite în mai multe fluxuri:

- page header;
- toolbar;
- table shell;
- pagination;
- modal/dialog;
- empty state.

### Faza 7 — Rute și componente

Migrează câte un flux complet:

1. componentă și pagină;
2. stilurile sale;
3. responsive-ul său;
4. stările sale;
5. eliminarea selectorilor legacy nefolosiți;
6. build și QA.

Ordine recomandată:

1. header și shell;
2. o pagină simplă publică;
3. cont;
4. dashboard;
5. workspace;
6. materii și teste;
7. admin;
8. licență/editorial/dicționar;
9. restul rutelor.

Admin și workspace nu trebuie alese primele: au cele mai multe dependențe și override-uri.

### Faza 8 — Curățare

Pentru fiecare selector legacy:

- caută utilizările în repository;
- elimină numai după ce nu mai este folosit;
- verifică buildul;
- verifică vizual ruta afectată;
- nu șterge reguli doar pentru că par duplicate.

## Reguli de siguranță

- Nu muta selectori după prefix în masă.
- Nu schimba ordinea cascadei fără verificare.
- Nu combina migrarea CSS cu redesign-ul.
- Nu introduce Sass doar pentru organizare.
- Nu introduce Tailwind în timpul acestei migrări.
- Nu transforma toate stilurile în primitive globale.
- Nu folosi `@apply`, mixins sau abstractions pentru a ascunde duplicări neînțelese.
- Nu șterge `!important` înainte de a elimina cauza conflictului.
- Nu înlocui toate clasele din JSX într-un singur task.

## Fișiere necesare pentru prima migrare reală

Pentru fazele Foundations + Shell sunt necesare:

- `app/layout.js`;
- `components/app-header.js`;
- `components/app-header-navigation.js`;
- componentele sidebar/mobile menu;
- `package.json`;
- scriptul executat de `npm run design:check`;
- scriptul executat de `npm run ui:check`.

Fără acestea putem audita CSS-ul, dar nu putem produce o înlocuire sigură a `globals.css`.

## Criteriul de final

Migrarea este reușită când:

- `globals.css` conține numai foundations și importurile globale aprobate;
- stilurile de rută sunt scoped;
- butoanele au rol semantic explicit;
- nu există reguli care trebuie să rămână „ultime” pentru a funcționa;
- numărul de `!important` scade controlat;
- CSS-ul nefolosit per rută scade;
- modificarea unei pagini nu schimbă accidental alta;
- buildul și QA-ul vizual trec după fiecare etapă.
