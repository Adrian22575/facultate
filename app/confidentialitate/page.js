import { PublicLegalPage } from "@/components/public-legal-page";
import { legalDetails } from "@/lib/legal";

export const metadata = {
  title: "Politica de confidentialitate | Nota 5+",
  description: "Cum sunt colectate, folosite si protejate datele in platforma Nota 5+.",
  alternates: { canonical: "/confidentialitate" }
};

export default function PrivacyPage() {
  return (
    <PublicLegalPage
      eyebrow="Date personale"
      title="Politica de confidentialitate"
      intro="Aici explicam ce date folosim, de ce sunt necesare si ce optiuni ai asupra lor."
    >
      <section>
        <h2>1. Cine prelucreaza datele</h2>
        <p>
          {legalDetails.operatorName} este operatorul datelor prelucrate prin Nota 5+. Datele complete
          de identificare si contact sunt afisate la inceputul acestei pagini.
        </p>
      </section>

      <section>
        <h2>2. Ce date folosim</h2>
        <ul>
          <li>Date de cont: email, nume, imagine de profil si identificatorul contului.</li>
          <li>Context academic: tipul de utilizator, institutia, programul, anul, clasa sau grupa alese.</li>
          <li>Materiale si continut: fisiere, texte, intrebari, raspunsuri si corecturi trimise de tine.</li>
          <li>Progres: raspunsuri, scoruri, greseli, flashcards revizuite si planuri de invatare.</li>
          <li>Date tehnice: evenimente de utilizare, erori, tipul dispozitivului si informatii de securitate.</li>
          <li>Date comerciale: pachetul ales, starea platii si identificatorii tranzactiei. Datele complete ale cardului sunt gestionate de procesatorul de plati.</li>
        </ul>
      </section>

      <section>
        <h2>3. De ce folosim datele</h2>
        <p>Folosim datele pentru a furniza contul si functiile solicitate, a salva progresul, a procesa materialele, a gestiona platile, a preveni abuzul si a imbunatati stabilitatea produsului.</p>
        <p>Temeiul poate fi executarea contractului, respectarea unei obligatii legale, interesul legitim pentru securitate si functionare sau consimtamantul, atunci cand acesta este cerut.</p>
      </section>

      <section>
        <h2>4. Materiale private si comunitate</h2>
        <p>Materialele incarcate sunt private initial. Ele devin vizibile comunitatii academice relevante numai dupa o actiune explicita de publicare. Poti raporta continutul nepotrivit, iar materialele publicate pot fi retrase in urma moderarii.</p>
      </section>

      <section>
        <h2>5. Furnizori si transferuri</h2>
        <p>Pentru functionarea serviciului folosim furnizori specializati pentru gazduire, baza de date, autentificare, stocare, plati, procesarea materialelor, analytics si monitorizarea erorilor. Acestia primesc numai datele necesare serviciului prestat si actioneaza pe baza unor obligatii contractuale.</p>
        <p>Daca datele sunt prelucrate in afara Spatiului Economic European, folosim mecanismele de transfer prevazute de legislatia aplicabila.</p>
      </section>

      <section>
        <h2>6. Cat timp pastram datele</h2>
        <p>Pastram datele cat timp contul este activ si atat cat este necesar pentru functiile solicitate. Unele evidente comerciale, de securitate sau solutionare a disputelor pot fi pastrate mai mult atunci cand legea ori un interes legitim o cere. La stergerea contului, datele sunt eliminate sau anonimizate, cu exceptia celor care trebuie pastrate legal.</p>
      </section>

      <section>
        <h2>7. Cookie-uri si stocare locala</h2>
        <p>Folosim cookie-uri si stocare locala necesare pentru autentificare, securitate, pastrarea sesiunii si preferinte functionale. Orice instrument optional care necesita consimtamant va fi activat numai dupa alegerea corespunzatoare.</p>
      </section>

      <section>
        <h2>8. Drepturile tale</h2>
        <p>Poti cere accesul, corectarea, stergerea, restrictionarea sau portarea datelor si te poti opune anumitor prelucrari. Cand prelucrarea se bazeaza pe consimtamant, il poti retrage. Pentru o solicitare foloseste adresa de contact afisata mai sus.</p>
        <p>Iti poti sterge direct contul si materialele private din sectiunea „Datele si contul meu” aflata in pagina Cont. Pentru acces, corectare, portare sau situatiile in care nu mai poti intra in cont, foloseste adresa de contact afisata mai sus.</p>
        <p>Ai si dreptul de a depune o plangere la Autoritatea Nationala de Supraveghere a Prelucrarii Datelor cu Caracter Personal.</p>
      </section>

      <section>
        <h2>9. Utilizatori minori</h2>
        <p>Platforma poate fi folosita si de elevi. Daca legislatia aplicabila cere acordul parintelui sau reprezentantului legal, contul trebuie folosit numai dupa obtinerea acelui acord. Nu trimite materiale care contin inutil date personale despre alti minori.</p>
      </section>

      <section>
        <h2>10. Securitate si modificari</h2>
        <p>Aplicam masuri tehnice si organizatorice pentru controlul accesului, stocare privata, limitarea solicitarilor si monitorizarea incidentelor. Niciun sistem nu poate garanta risc zero. Putem actualiza aceasta politica atunci cand produsul sau cerintele legale se schimba; versiunea curenta ramane publicata aici.</p>
      </section>
    </PublicLegalPage>
  );
}
