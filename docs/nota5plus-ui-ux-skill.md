# Nota 5+ UI/UX Skill

Acest document este sursa de adevar pentru designul vizibil al aplicatiei `Nota 5+`.
Se aplica pentru login, onboarding, cont, dashboard, pricing si paginile principale de produs.

## 1. Identitate vizuala

- Branding vizibil: `Nota 5+`
- Brand mark: patrat rotunjit cu `5+`, gradient albastru
- Personalitate: calma, academica, clara, optimista
- Impresie generala: produs modern pentru sesiune si examene, nu dashboard generic

## 2. Tipografie si ton

- Se pastreaza fontul global actual al proiectului
- Nu se introduce font nou doar pentru pagini de marketing sau branding
- Headline-urile pot fi puternice, dar restul paginii trebuie sa ramana calm
- Copy-ul trebuie sa fie scurt, clar si orientat pe rezultat
- Ton: incurajator, direct, fara jargon tehnic

Ierarhia de greutate:
- `900` doar pentru headline-uri majore, preturi si CTA-ul principal
- `700` pentru titluri scurte, labels importante si badge-uri relevante
- `500/600` pentru descrieri, microcopy, texte comparative si explicatii

Nu afisa in interfata:
- termeni de infrastructura
- termeni interni de platforma
- nume de provideri tehnici
- explicatii de setup

## 3. Paleta si sistem vizual

- Albastru principal: `#1250b1`
- Albastru inchis: `#0b367d`
- Albastru soft: `#eaf2ff`
- Text principal: `#14213d`
- Text secundar: `#60708d`
- Border: `#dbe5f2`
- Background public si privat: gradient rece, luminos, cu accente radiale discrete
- Accent verde: pentru stari pozitive
- Accent portocaliu: doar atmosferic sau pentru callout-uri calde, nu pentru CTA principal

Stil general:
- colturi rotunjite mari
- umbre soft, ample
- suprafete curate, aerisite
- contrast bun intre text si fundal
- fara bold inutil doar pentru impresie vizuala

## 4. Reguli de compozitie

### Pentru paginile publice

- primul ecran trebuie sa functioneze ca un poster de brand
- nav simplu, putine elemente
- structura hero in 2 coloane pe desktop
- stanga: promisiune + CTA principal
- dreapta: mockup, proof sau context vizual de incredere
- sub hero: sectiuni scurte de tip `cum functioneaza`, `de ce`, `comunitate`

### Pentru paginile private

- raman mai sobre decat landing-ul, dar cu acelasi ADN vizual
- folosesc aceleasi culori, aceleasi umbre si aceeasi forma a cardurilor
- cardurile apar doar cand au rol clar: rezumat, decizie, progres, actiune
- nu copiaza mecanic hero-ul public, dar pot avea sectiuni expressive si bine aerisite

### Pentru CTA

- un singur CTA principal per zona importanta
- CTA-ul principal trebuie sa fie foarte clar si dominant vizual
- CTA-urile secundare sunt luminoase, conturate si mai calme
- iconografia trebuie sa sustina actiunea, nu sa o incarce

### Pentru carduri

- cardurile trebuie sa fie putine si cu rol clar
- evita dashboard mosaics si grile fara ierarhie
- daca un element nu ajuta utilizatorul sa decida sau sa continue, se elimina
- cardurile de pret trebuie sa includa context util, nu doar nume + suma

## 5. Pattern-uri recomandate

- brand sus stanga, foarte clar
- headline mare, 2-3 randuri
- paragraf de suport scurt
- section label / pill de context
- un CTA dominant
- 3-4 carduri de rezumat cand pagina chiar are nevoie de scanare rapida
- 3 pasi explicativi sub hero cand explici un flux
- spatiere generoasa
- max 1-2 idei vizuale dominante per ecran

Primitivele recomandate in CSS:
- `ui-panel-card`
- `ui-dark-cta-panel`
- `ui-icon-box`
- `ui-chip`
- `ui-section-label`
- `ui-section-head`
- `ui-segmented-tabs`
- `ui-price-card`
- `ui-actions-row`

## 6. Pricing

Terminologie:
- `Acces`
- `Materiale incarcate`
- `Incarcari de materiale`

Reguli:
- pretul este vizibil imediat
- cardul recomandat poate avea badge discret
- comparative copy sta in card, nu separat, daca ajuta decizia
- descrierea trebuie sa explice momentul de folosire, nu doar durata

Exemple bune:
- `Acces 24 ore` + `Mai putin decat o cafea.`
- `Acces 7 zile` + `Cat 2 drumuri cu metroul pana la facultate si inapoi.`
- `Acces 30 zile` + `Mai ieftin pe zi decat un snack rapid din campus.`

## 7. Ce este interzis

- multe butoane primare concurente in aceeasi zona
- explicatii tehnice sau de setup in pagini publice
- card grids generice de tip SaaS fara ierarhie
- texte lungi de onboarding in zona de brand public
- UI aglomerat cu explicatii redundante
- bold excesiv pe pill-uri, microcopy si descrieri

## 8. Aplicare practica

La orice pagina noua `Nota 5+`, verifica:

1. brandul este imediat recognoscibil
2. exista o actiune principala clara
3. headline-ul spune clar de ce exista pagina
4. copy-ul poate fi scanat in cateva secunde
5. suprafetele au aer si nu par ingramadite
6. badge-urile, pills si icon-boxes respecta acelasi limbaj vizual
7. designul nu arata ca un admin generic

## 9. Implementari de referinta

Implementarile de referinta pentru acest sistem sunt:
- `app/auth/login/page.js`
- `app/cont/page.js`

Aceste pagini stabilesc:
- tonul public al produsului
- tonul privat al produsului
- stilul CTA-ului principal
- relatia dintre branding, comunitate, pricing si invatare rapida
