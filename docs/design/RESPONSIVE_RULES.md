# Responsive Rules

## Principiu

Interfața se adaptează sarcinii, nu doar se micșorează. Pe mobil, utilizatorul trebuie să poată vedea acțiunea principală, să citească fără zoom și să termine fluxul fără scroll orizontal.

## Reguli

1. Proiectează mai întâi ordinea conținutului mobil: context, informație necesară, acțiune principală, apoi detalii și acțiuni secundare.
2. Folosește punctele de schimbare deja prezente în stiluri atunci când structura o cere; shell-ul aplicației tratează desktopul de la `901px` în sus. Nu introduce breakpoint-uri arbitrare pentru un singur caz fără motiv.
3. La lățimi mici, stivuiește coloanele, reduce spațiul exterior înainte de a reduce lizibilitatea și menține titlurile și controalele fără tăieri.
4. Țintele interactive ating minimum `44px`; proiectul folosește tokenul `--touch-target: 48px` atunci când se aplică.
5. Nu introduce scroll orizontal la nivel de pagină. Pentru informația densă, prioritizează câmpurile, oferă detalii la cerere sau folosește o zonă de scroll locală explicată.
6. Nu baza accesul la informație pe hover. Orice funcție disponibilă la hover trebuie să rămână disponibilă prin touch și tastatură.
7. Bara de navigare, taburile și grupurile de acțiuni trebuie să aibă o strategie mobilă clară: împachetare, scroll local controlat, meniu sau prioritizare.
8. Verifică formele lungi, mesajele de eroare, chip-urile, tabelele și dialogurile la `390px`, `768px`, `1024px` și `1440px`.
9. Respectă safe area de jos, focusul vizibil și navigarea cu tastatura; nu acoperi acțiunile importante cu elemente fixe.
