# Reguli de layout și spațiere

## Scop

Spațierea exprimă ierarhia paginii. Nu este un remediu local pentru un element care pare deplasat. Fiecare ecran folosește aceeași scară, astfel încât pagina rămâne echilibrată la orice lățime și nu acumulează goluri arbitrare între header, controale și conținut.

## Scara obligatorie

Folosește numai tokenurile din `app/globals.css` pentru spațierea nouă:

| Token | Valoare | Rol principal |
| --- | ---: | --- |
| `--space-0` | 0 | anularea spațierii implicite |
| `--space-1` | 4px | legătură strânsă între etichetă și control |
| `--space-2` | 8px | elemente din același control |
| `--space-3` | 12px | grup compact de controale |
| `--space-4` | 16px | grup de conținut sau padding compact |
| `--space-5` | 24px | secțiune normală și padding de card |
| `--space-6` | 32px | separare majoră / gutter desktop |
| `--space-7` | 48px | final de pagină sau separare amplă |
| `--space-8` | 64px | doar pentru tranziții intenționate între zone distincte |

Nu se introduc valori noi precum `18px`, `22px`, `28px` sau `56px` pentru `margin`, `padding` ori `gap`. Dacă un caz real nu încape în scală, se extinde design system-ul cu un token și motivul este documentat în același PR.

## Contractul de layout

```text
viewport
  └─ page gutter (doar .app-shell)
       └─ secțiuni cu gap de 24px
            └─ card sau panou cu padding de 24px
                 └─ grupuri interne de 16px / controale de 8–12px
```

- Doar containerul de pagină stabilește gutter-ul exterior: `--page-gutter`.
- Doar un părinte stabilește distanța dintre secțiuni: `gap: var(--layout-section-gap)`.
- Cardurile folosesc `--layout-card-padding`; pe mobil pot folosi `--layout-card-padding-compact`.
- Orice componentă care intră direct în `.admin-route-content` și devine card prin shell își declară explicit paddingul. Un fundal și o bordură fără padding sunt defecte de layout, nu o alegere de densitate.
- Pentru elemente consecutive, preferă `display: grid`/`flex` + `gap`; nu adăuga `margin-top` pe fiecare copil.
- Un copil nu compensează paddingul părintelui cu margini negative sau cu `margin` mare.
- Nu se împachetează o secțiune într-un card numai pentru a crea spațiu. Spațiul dintre secțiuni este responsabilitatea layoutului părinte.

## Header, toolbar și listă

- Headerul paginii, toolbarul și prima listă folosesc aceeași succesiune: `24px` între blocuri, `16px` între controale, `8–12px` în interiorul unui control.
- Nu se folosesc paddinguri asimetrice pentru aliniere vizuală. Alinierea se rezolvă prin grid/flex, `min-width` și `align-items`.
- O listă începe imediat după toolbarul care o filtrează. Nu se adaugă panouri goale sau marje suplimentare între ele.
- În Admin, `.admin-route-shell`, `.admin-route-topbar`, `.admin-route-header` și cardurile principale trebuie să folosească tokenurile de spațiere, nu valori brute.

## Mobile

- Sub `761px`, se reduce mai întâi gutter-ul exterior la `16px`; spațiul intern al controalelor rămâne lizibil.
- Nu micșora vertical spațiul de atingere sub `44px` pentru a rezolva o problemă de densitate.
- Când un toolbar nu încape, se rearanjează în rânduri sau într-un control compact; nu se lărgește pagina și nu se adaugă spațiu gol pentru a masca overflow-ul.

## Verificare obligatorie

1. Rulează `npm run design:check`. Acesta verifică tokenurile, contractul principal al shell-ului și orice regulă CSS adăugată după markerul de protecție.
2. Rulează `npm run ui:check` și buildul pentru o schimbare de interfață.
3. La QA, compară explicit distanțele dintre: topbar → titlu, titlu → primul control, toolbar → listă și card → conținut, la `1440px`, `1024px`, `768px` și `390px`.
4. Dacă vezi o distanță mare, identifică mai întâi cine o deține (page shell, secțiune sau card). Nu adăuga un override pe copil.

## Protecție în cod

La finalul `app/globals.css` există markerul `DESIGN-SPACING-GUARD`. CSS-ul nou adăugat după marker este verificat automat: declarațiile de `margin`, `padding` și `gap` nu pot conține pixeli bruti și trebuie să folosească tokenurile de mai sus. Markerul rămâne la finalul fișierului.
