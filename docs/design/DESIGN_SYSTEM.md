# Design System

## Sursa de adevăr

Stilurile globale actuale sunt în `app/globals.css`. Înainte de a adăuga reguli locale, reutilizează tokenurile și tiparele de acolo. Nu există o bibliotecă UI externă sau un `Button` universal care să înlocuiască automat variantele locale; inspectează componenta și clasa existente pentru fluxul atins.

## Typography

- Interfața moștenește fontul sans-serif al browserului; controalele folosesc `font: inherit`.
- Pentru introducere de formule există `.math-friendly-input`, cu fallback-uri precum Segoe UI, Cambria Math și STIX Two Math.
- Nu introduce fonturi noi fără aprobare.
- Păstrează titlurile și textul de interfață compacte, lizibile și coerente cu pagina existentă.
- Textul relevant nu coboară sub `14px`.

## Colors

Folosește tokenurile existente, nu culori noi hardcodate, cu excepția situațiilor în care extinzi explicit sistemul:

| Rol | Token | Valoare actuală |
| --- | --- | --- |
| Fundal aplicație | `--bg` | `#f5f8fd` |
| Suprafață | `--surface` | `#ffffff` |
| Suprafață discretă | `--surface-soft` | `#f7fbff` |
| Text principal | `--ink` | `#14213d` |
| Text secundar | `--muted` | `#60708d` |
| Bordură | `--line` | `#dbe5f2` |
| Acțiune principală | `--primary` | `#1250b1` |
| Stare activă / hover principal | `--primary-dark` | `#0b367d` |
| Fundal principal discret | `--primary-soft` | `#eaf2ff` |
| Succes | `--good` | `#1f9d63` |
| Eroare / distructiv | `--bad` | `#b4232c` |

- Albastrul principal este pentru acțiunea principală, elementul activ și linkuri importante.
- Roșul este doar pentru erori și acțiuni destructive; verdele doar pentru succes sau status pozitiv.
- Nu introduce gradiente decorative noi. Gradiente existente se păstrează când sunt deja parte dintr-un flux, dar nu devin un model implicit.

## Spacing, borders and elevation

- Folosește scara `4, 8, 12, 16, 24, 32, 48px` și valorile apropiate doar când un tipar existent o cere.
- Regulile obligatorii de container, ierarhie și verificare automată sunt în [LAYOUT_SPACING_RULES.md](./LAYOUT_SPACING_RULES.md). Pentru layout nou, tokenurile `--space-*` sunt obligatorii; nu se adaugă valori brute de spațiere.
- Tokenurile existente sunt `--radius: 26px`, `--radius-soft: 20px`, `--shadow` și `--shadow-soft`. Reutilizează-le în locul unor valori noi.
- Bordurile sunt subtile, de regulă cu `--line` sau `--line-strong`. Umbrele puternice nu sunt pentru conținut obișnuit.
- Nu împacheta fiecare secțiune într-un card.

## Components and interaction patterns

Înainte de a crea o componentă nouă, verifică tiparele reutilizabile existente: `WorkspaceMainTabsClient`, `AdminTabsContainer`, `WorkspaceSubjectPicker`, `GoogleSignInButton`, `OnboardingSubmitButton`, `QuestionCorrectionButton` și componentele de modal din fluxurile relevante.

- Pentru acțiuni, pornește de la clasele și variantele de buton deja folosite de pagină, de exemplu `.btn-primary`, `.btn-link` și `.btn-back`.
- Pentru taburi, extinde modelele de taburi existente; pentru dialoguri, respectă focusul, Escape și închiderea clară din modelele locale.
- Pentru formulare, folosește controale native cu etichete vizibile, stare de eroare și focus vizibil.
- Pentru badge-uri, alerte, carduri și tabele, reutilizează tiparul deja prezent în fluxul respectiv și păstrează semantica HTML.
