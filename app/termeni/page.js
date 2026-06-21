import { PublicLegalPage } from "@/components/public-legal-page";
import { legalDetails } from "@/lib/legal";

export const metadata = {
  title: "Termeni si conditii | Nota 5+",
  description: "Regulile de folosire a platformei educationale Nota 5+.",
  alternates: { canonical: "/termeni" }
};

export default function TermsPage() {
  return (
    <PublicLegalPage
      eyebrow="Regulile serviciului"
      title="Termeni si conditii"
      intro="Prin folosirea Nota 5+ accepti regulile de mai jos si politica de confidentialitate."
    >
      <section>
        <h2>1. Serviciul</h2>
        <p>{legalDetails.operatorName} pune la dispozitie o platforma educationala pentru organizarea materialelor, teste, flashcards, progres, simulare si invatare in comunitati academice.</p>
      </section>

      <section>
        <h2>2. Contul tau</h2>
        <p>Trebuie sa oferi informatii corecte, sa protejezi accesul la cont si sa ne anunti daca observi o utilizare neautorizata. Nu poti folosi identitatea altei persoane sau crea conturi pentru a evita limitele serviciului.</p>
      </section>

      <section>
        <h2>3. Materialele incarcate</h2>
        <p>Pastrezi drepturile asupra continutului tau. Confirmi ca ai dreptul sa il incarci si ca nu incalca drepturi de autor, confidentialitatea, protectia datelor sau alte drepturi. Ne permiti sa procesam si sa stocam materialul strict pentru furnizarea functiilor solicitate.</p>
      </section>

      <section>
        <h2>4. Publicarea in comunitate</h2>
        <p>Un material este privat pana cand alegi explicit sa il publici. Prin publicare permiti membrilor comunitatii academice selectate sa il foloseasca pentru invatare. Poti cere retragerea lui, iar noi il putem modera sau elimina daca este raportat ori incalca acesti termeni.</p>
      </section>

      <section>
        <h2>5. Continut educational</h2>
        <p>Rezultatele procesarii pot contine erori sau formulari care necesita verificare. Platforma ajuta la invatare, dar nu garanteaza o anumita nota, promovarea unui examen sau caracterul oficial al materialelor. Verifica informatiile importante folosind sursele cursului si indicatiile profesorului.</p>
      </section>

      <section>
        <h2>6. Utilizare acceptabila</h2>
        <ul>
          <li>Nu incarca continut ilegal, abuziv, periculos sau care apartine altcuiva fara permisiune.</li>
          <li>Nu incerca sa accesezi conturile, datele sau comunitatile altor persoane.</li>
          <li>Nu automatiza solicitari excesive si nu ocoli limitele, platile sau masurile de securitate.</li>
          <li>Nu revinde accesul si nu prezenta materialele comunitatii ca fiind verificate oficial.</li>
        </ul>
      </section>

      <section>
        <h2>7. Pachete si plati</h2>
        <p>Pretul, continutul pachetului si moneda sunt afisate inainte de plata. Confirmarea platii actualizeaza accesul conform ofertei acceptate. Drepturile legale ale consumatorului, inclusiv cele privind retragerea si rambursarea atunci cand sunt aplicabile, nu sunt limitate de acesti termeni.</p>
      </section>

      <section>
        <h2>8. Disponibilitate</h2>
        <p>Urmarim sa mentinem serviciul stabil, dar pot exista perioade de mentenanta, erori ale furnizorilor sau situatii in afara controlului nostru. Vom incerca sa protejam progresul salvat si sa comunicam incidentele relevante.</p>
      </section>

      <section>
        <h2>9. Suspendare si inchidere</h2>
        <p>Putem limita sau inchide accesul pentru frauda, abuz, risc de securitate sau incalcari repetate. Poti solicita inchiderea contului si stergerea datelor, sub rezerva obligatiilor legale de pastrare.</p>
      </section>

      <section>
        <h2>10. Raspundere si lege aplicabila</h2>
        <p>Raspunderea fiecarei parti se stabileste conform legii aplicabile si nu excludem drepturi care nu pot fi limitate legal. Termenii sunt guvernati de legea romana. Incercam mai intai solutionarea amiabila a oricarei probleme prin adresa de contact afisata mai sus.</p>
      </section>

      <section>
        <h2>11. Modificari</h2>
        <p>Putem actualiza termenii cand produsul, preturile sau cerintele legale se schimba. Pentru modificarile importante vom folosi o notificare rezonabila, iar versiunea curenta va ramane disponibila pe aceasta pagina.</p>
      </section>
    </PublicLegalPage>
  );
}
