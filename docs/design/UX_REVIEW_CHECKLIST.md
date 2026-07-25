# UX Review Checklist

Folosește această listă înainte de a preda o schimbare de interfață.

## Scop și structură

- [ ] Scopul paginii și utilizatorul sunt clare.
- [ ] Există o singură acțiune principală vizibilă.
- [ ] Sunt cel mult două acțiuni secundare vizibile.
- [ ] Informația necesară precede detaliile opționale.
- [ ] Taburile, dialogurile, drawer-ele sau paginile separate au o justificare de sarcină.
- [ ] Nu există dashboard, statistică, card sau grafic fără utilitate pentru o decizie.

## Conținut și stări

- [ ] Etichetele sunt specifice, în română și fără placeholder-e finale.
- [ ] Încărcarea, starea goală, eroarea, succesul și starea disabled sunt tratate când sunt relevante.
- [ ] Acțiunile destructive sunt distincte și confirmate când trebuie.
- [ ] Nu a fost modificată logica de business doar pentru o schimbare de layout.

## Sistem și accesibilitate

- [ ] Sunt reutilizate tokenurile, componentele și tiparele locale.
- [ ] Nu au fost introduse fonturi, culori sau gradiente decorative neaprobate.
- [ ] Textul relevant este de minimum 14px și contrastul rămâne lizibil.
- [ ] Focusul este vizibil; controalele au etichete și se pot folosi de la tastatură.
- [ ] Țintele tactile au minimum 44px când se aplică.

## Responsive și verificare vizuală

- [ ] Nu există scroll orizontal la nivelul paginii la `390px`.
- [ ] Tabelele și listele dense au o strategie mobilă intenționată.
- [ ] Au fost verificate ierarhia, spațierea, alinierea, overflow-ul, wrapping-ul și spațiul gol la `1440px`, `1024px`, `768px` și `390px`.
- [ ] După corecții, capturile au fost refăcute și schimbarea a fost verificată în browser când taskul include UI.
