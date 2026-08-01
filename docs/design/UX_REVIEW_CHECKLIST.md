# UX Review Checklist

## Rol

Folosește acest checklist înainte de predarea unei schimbări UI/UX.

Acest fișier nu definește reguli noi și nu explică soluțiile.
Pentru detalii, consultă:

- `PRODUCT_UX_PRINCIPLES.md`;
- `PAGE_STRUCTURE_RULES.md`;
- `DESIGN_SYSTEM.md`;
- `LAYOUT_SPACING_RULES.md`;
- `RESPONSIVE_RULES.md`.

Bifează numai verificările relevante pentru task.
Dacă un punct nu se aplică, marchează-l `N/A`.

## 1. Scop și structură

- [ ] Scopul unic al paginii este clar.
- [ ] Acțiunea principală este evidentă.
- [ ] Sunt vizibile maximum două acțiuni secundare.
- [ ] Informația necesară apare înaintea detaliilor.
- [ ] Fiecare secțiune susține o decizie, o acțiune sau o stare necesară.
- [ ] Conținutul secundar este mutat, ascuns sau eliminat când nu este necesar imediat.
- [ ] Containerul ales este potrivit: pagină, tab, drawer, modal, expandable sau inline.
- [ ] Nu există dashboard, card, metrică sau grafic fără utilitate demonstrabilă.
- [ ] Nu există informație repetată în mai multe zone.

## 2. Conținut

- [ ] Copy-ul este real, specific și în română.
- [ ] Nu există placeholder-e finale.
- [ ] Nu există termeni tehnici interziși în interfața utilizatorului.
- [ ] Etichetele explică acțiunea fără texte lungi de ajutor.
- [ ] Nu au fost inventate funcționalități, recomandări, metrici, testimoniale sau beneficii.
- [ ] Textele lungi și valorile dinamice nu rup layout-ul.

## 3. Acțiuni și componente

- [ ] Acțiunile sunt clasificate corect: primary, secondary, text sau destructive.
- [ ] Stările `hover`, `focus-visible`, `active` și `disabled` sunt corecte când se aplică.
- [ ] Acțiunile destructive sunt separate și confirmate când este necesar.
- [ ] Componentele și patternurile existente au fost reutilizate numai când semantica este aceeași.
- [ ] Nu a fost creată o componentă globală pentru un singur caz.
- [ ] Cardurile reprezintă grupuri autonome, nu sunt folosite pentru padding sau decor.

## 4. Layout și spacing

- [ ] Fiecare spațiu are un proprietar clar.
- [ ] Shell-ul controlează gutter-ul paginii.
- [ ] Părintele controlează distanța dintre secțiuni.
- [ ] Componentele controlează numai spacing-ul intern.
- [ ] Sunt folosite tokenurile aprobate.
- [ ] Nu există valori brute nejustificate pentru `margin`, `padding` sau `gap`.
- [ ] Nu există margini negative, compensări fragile sau wrapper-e fără rol.
- [ ] Spațiul gol este intenționat și nu a fost umplut artificial.

## 5. Responsive

- [ ] Ordinea mobilă este intenționată.
- [ ] Acțiunea principală rămâne vizibilă pe mobil.
- [ ] Nu există scroll orizontal la nivelul paginii.
- [ ] Textul poate fi citit fără zoom.
- [ ] Targeturile tactile au minimum `44px` când se aplică.
- [ ] Toolbars, taburile, sidebar-urile și tabelele au strategie mobilă explicită.
- [ ] Funcțiile disponibile la hover sunt disponibile și prin touch și tastatură.
- [ ] Elementele fixed sau sticky nu acoperă conținutul.
- [ ] Conținutul lung, erorile și stările goale nu rup layout-ul.

## 6. Formulare și stări

- [ ] Fiecare control are label vizibil.
- [ ] Erorile sunt asociate câmpurilor și explică remedierea.
- [ ] Loading, empty, error, success și disabled sunt tratate când sunt relevante.
- [ ] Permission denied și setup incomplet sunt tratate când sunt posibile.
- [ ] Submit-ul și acțiunile secundare au ordine clară.
- [ ] Tastatura mobilă nu blochează finalizarea formularului.

## 7. Accesibilitate

- [ ] Focusul este vizibil.
- [ ] Navigarea cu tastatura funcționează.
- [ ] Dialogurile gestionează focusul, Escape și închiderea.
- [ ] Icon buttons au etichete accesibile.
- [ ] Stările nu sunt comunicate numai prin culoare.
- [ ] Contrastul și dimensiunea textului respectă design system-ul.

## 8. Integritate tehnică

- [ ] Logica de business nu a fost modificată fără cerință explicită.
- [ ] Permisiunile, API-urile și contractele de date au fost păstrate.
- [ ] Stilurile specifice paginii nu au fost mutate inutil în `globals.css`.
- [ ] Nu există selectori globali largi sau `!important` introduse pentru a câștiga conflicte.
- [ ] Nu au fost făcute refactorizări fără legătură cu taskul.
- [ ] Fișierele modificate se încadrează în scopul declarat.

## 9. Verificare

- [ ] A fost rulat `npm run design:check` când taskul modifică UI sau CSS.
- [ ] A fost rulat `npm run ui:check` când taskul modifică UI.
- [ ] A fost rulat `npm run build` când taskul modifică aplicația.
- [ ] A fost rulat `npm run agent:check` când s-au modificat documente, skill-uri sau structura repository-ului.
- [ ] Pagina a fost verificată în browser când mediul era disponibil.
- [ ] Au fost verificate dimensiunile relevante dintre `1440px`, `1024px`, `768px` și `390px`.
- [ ] După corecții, verificarea vizuală a fost repetată.
- [ ] Orice verificare care nu a putut fi făcută este raportată explicit.

## 10. Rezultat final

- [ ] Utilizatorul poate identifica rapid unde se află.
- [ ] Utilizatorul poate identifica următorul pas.
- [ ] Pagina nu pare completă doar pentru că este plină.
- [ ] Nu există elemente adăugate doar pentru decor sau umplerea spațiului.
- [ ] Schimbarea rezolvă cerința fără efecte secundare cunoscute.
