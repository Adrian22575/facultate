# Nota 5+ UI/UX Skill

## Rol

Acest skill este punctul de intrare pentru orice task de UI, UX, wireframe, layout sau redesign în `Nota 5+`.

El nu definește tokenuri, reguli de spacing, responsive sau arhitectură în detaliu.
Pentru acestea se folosesc documentele autoritare din `docs/design/`.

## Ordinea de citire

Pentru orice task UI/UX, citește în această ordine:

1. `AGENTS.md`;
2. acest skill;
3. `docs/design/PRODUCT_UX_PRINCIPLES.md`;
4. `docs/design/PAGE_STRUCTURE_RULES.md`;
5. `docs/design/DESIGN_SYSTEM.md`;
6. `docs/design/LAYOUT_SPACING_RULES.md`;
7. `docs/design/RESPONSIVE_RULES.md`;
8. fișierele și componentele direct afectate.

La final folosește:

- `docs/design/UX_REVIEW_CHECKLIST.md`.

Nu copia automat un pattern existent dacă acesta contrazice documentele autoritare.

## Clasificarea taskului

Înainte de modificări, stabilește tipul taskului:

- `audit` — analizează, fără modificări;
- `arhitectură/redesign` — definește structura înainte de implementare;
- `wireframe` — propune layout low-fidelity, fără logică de business;
- `implementare UI` — implementează numai structura cerută sau aprobată;
- `corecție punctuală` — repară strict problema locală;
- `responsive` — adaptează structura și prioritatea informației, nu doar dimensiunile.

Urmează workflow-ul definit în `AGENTS.md` pentru tipul ales.

## Reguli obligatorii

- Păstrează logica de business, datele, permisiunile și contractele existente.
- Nu inventa funcționalități, metrici, texte, recomandări, testimoniale sau stări.
- Nu afișa toate datele doar pentru că există.
- Nu transforma automat o pagină într-un dashboard.
- Nu adăuga carduri, grafice, CTA-uri sau explicații doar pentru a umple spațiul.
- Nu adăuga un al doilea sidebar fără aprobare explicită.
- Nu introduce termeni tehnici interziși în interfața utilizatorului.
- Nu extinde scopul taskului.
- Nu introduce valori CSS, tokenuri sau componente globale fără justificare.
- Nu declara QA vizual făcut dacă pagina nu a fost verificată în browser.

## Pentru pagini noi sau redesign-uri

Înainte de implementare, definește:

```text
Scopul paginii:
Utilizatorul:
Decizia principală:
Acțiunea principală:
Informația necesară:
Informația amânată:
Structura desktop:
Structura mobil:
Ce se elimină, mută sau ascunde:
```

Detaliile despre pagini, taburi, drawer-e, modaluri, dashboard-uri, liste, tabele și formulare sunt în `PAGE_STRUCTURE_RULES.md`.

## Pentru wireframe-uri

Wireframe-ul trebuie să arate:

- ordinea conținutului;
- ierarhia;
- dimensiunea relativă a zonelor;
- acțiunea principală;
- desktop și mobil când sunt relevante.

Wireframe-ul nu trebuie să conțină conținut inventat sau elemente introduse doar pentru decor.

## Pentru implementare

- Verifică mai întâi catalogul din `docs/design/DESIGN_SYSTEM.md` și primitivele din `components/ui/`.
- Pentru acțiuni, câmpuri text-like, selecturi, textarea, statusuri și feedback inline folosește API-ul canonic când semantica se potrivește.
- Clasele legacy rămân numai pentru consumatorii existenți; nu le folosi în cod nou și nu crea butoane native fără clasă.
- Refolosește componentele numai când semantica și stările sunt aceleași.
- Pentru suprafețe și stări structurale verifică `SurfaceCard`, `EmptyState`, `LoadingState` și `FeedbackState` înainte să creezi un container nou.
- Pentru colecții verifică `components/ui/collection-controls.js` înainte să creezi toolbar, search, filtru, sortare, contor sau paginare nouă.
- Pentru date comparabile pe coloane folosește `DataTable` din `components/ui/data-table.js`; caption-ul este obligatoriu, iar responsive-ul este limitat la `scroll` sau `cards`.
- Pentru etichete scurte de secțiune și progres determinist folosește `SectionLabel` și `ProgressBar` din `components/ui/`.
- Păstrează structurile specializate cu un singur consumator colocate și nu adăuga geometrie nouă de colecție sau tabel în `app/globals.css`.
- Stilurile specifice unei singure pagini rămân într-un CSS Module colocat; nu adăuga o clasă globală nouă de tip card, panel, surface sau state.
- O variantă canonică nouă cere cel puțin două utilizări reale și trebuie înregistrată în component map.
- Respectă documentele de design.
- Implementează responsive explicit.
- Verifică stările relevante.
- Nu adăuga secțiuni sau acțiuni necerute.
- Nu transforma o corecție locală într-un redesign global.

## Verificare

Pentru taskuri UI folosește verificările relevante definite în `AGENTS.md`.

La final parcurge `UX_REVIEW_CHECKLIST.md`.

Dacă o verificare nu poate fi făcută, raportează exact ce a rămas neverificat.
