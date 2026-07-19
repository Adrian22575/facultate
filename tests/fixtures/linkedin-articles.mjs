const base = {
  status: "published",
  published_at: "2026-07-18T09:00:00.000Z",
  subtitle: "",
  key_takeaways: [],
  sections: [],
  student_implications: [],
  conclusion: ""
};

function fixture(index, kind, value) {
  return {
    ...base,
    id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    slug: `fixture-linkedin-${kind}`,
    kind,
    ...value
  };
}

export const linkedinArticleFixtures = [
  fixture(1, "education_news", {
    title: "Calendar unic pentru înscrierea la bursele universitare",
    summary: "Ministerul Educației a publicat un calendar național cu termen final la 30 septembrie 2026, iar universitățile pot adăuga etape locale fără să scurteze perioada de depunere.",
    key_takeaways: ["Termenul final național este 30 septembrie 2026.", "Universitățile pot adăuga etape locale."],
    sections: [{ title: "Ce se schimbă", content: "Calendarul introduce o perioadă comună de depunere. Regulamentele locale trebuie publicate înainte de deschiderea înscrierilor.", keyClaims: ["Regulamentele locale trebuie publicate înainte de deschiderea înscrierilor."] }],
    conclusion: "Studenții au un reper comun, dar trebuie să consulte și regulamentul propriei universități."
  }),
  fixture(2, "ai", {
    title: "Asistenții de studiu pot explica, dar nu pot valida sursa în locul studentului",
    summary: "Un proiect pilot cu 240 de studenți a comparat răspunsurile generate cu verificarea bibliografiei. Timpul de orientare a scăzut, însă erorile de citare au rămas atunci când sursele nu au fost verificate separat.",
    key_takeaways: ["Proiectul pilot a inclus 240 de studenți.", "Verificarea bibliografiei a rămas necesară."],
    sections: [{ title: "Rezultatul", content: "Participanții au găsit mai repede termenii de căutare, dar au primit și trimiteri bibliografice inexacte.", keyClaims: ["Participanții au găsit mai repede termenii de căutare."] }],
    conclusion: "Instrumentul poate accelera orientarea, nu poate înlocui verificarea surselor."
  }),
  fixture(3, "educational", {
    title: "Cum se citește corect o rată de promovare",
    summary: "Rata de promovare depinde de numitor: studenți înscriși, prezenți sau evaluați. Comparațiile sunt valide numai când definiția și perioada sunt aceleași.",
    key_takeaways: ["Numitorul schimbă interpretarea ratei.", "Perioadele comparate trebuie să fie identice."],
    sections: [{ title: "Exemplu", content: "Optzeci de promovări din o sută de studenți prezenți înseamnă 80%, dar nu spune câți studenți înscriși au absentat.", keyClaims: ["Optzeci de promovări din o sută de studenți prezenți înseamnă 80%."] }],
    conclusion: "Înaintea procentului trebuie verificată definiția populației măsurate."
  }),
  fixture(4, "case_study", {
    title: "O facultate a redus cozile la secretariat prin programări pe intervale",
    summary: "Facultatea a introdus programări de 10 minute pentru eliberarea actelor. În șase săptămâni, timpul median de așteptare a coborât de la 47 la 14 minute.",
    key_takeaways: ["Programările au intervale de 10 minute.", "Timpul median a coborât de la 47 la 14 minute în șase săptămâni."],
    sections: [{ title: "Decizia", content: "Echipa a păstrat un interval liber după fiecare cinci programări pentru întârzieri și cazuri neprevăzute.", keyClaims: ["Un interval liber este păstrat după fiecare cinci programări."] }],
    conclusion: "Rezultatul a venit din controlul fluxului, nu doar din mutarea formularului online."
  }),
  fixture(5, "promotional", {
    title: "Nota5Plus lansează un spațiu de recapitulare pentru examene",
    summary: "Noul spațiu permite organizarea materialelor pe materii, întrebări de verificare și urmărirea capitolelor parcurse. Accesul de test este disponibil timp de 14 zile.",
    key_takeaways: ["Materialele pot fi organizate pe materii.", "Accesul de test este disponibil timp de 14 zile."],
    sections: [{ title: "Pentru cine", content: "Funcția este destinată studenților care lucrează cu mai multe suporturi de curs și vor să vadă ce au parcurs.", keyClaims: ["Funcția urmărește capitolele parcurse."] }],
    conclusion: "Produsul reduce fragmentarea recapitulării, fără să înlocuiască suportul de curs."
  }),
  fixture(6, "data_statistics", {
    title: "Prezența la seminare și promovarea nu evoluează identic",
    summary: "Într-un set anonim de 1.200 de înregistrări, promovarea a fost 72% pentru prezență peste 80% și 61% pentru prezență între 50% și 80%. Datele arată asociere, nu cauzalitate.",
    key_takeaways: ["Setul conține 1.200 de înregistrări anonime.", "Datele arată asociere, nu cauzalitate."],
    sections: [{ title: "Limite", content: "Analiza nu controlează dificultatea disciplinelor, experiența profesorilor sau timpul individual de studiu.", keyClaims: ["Analiza nu controlează dificultatea disciplinelor."] }],
    conclusion: "Procentul poate semnala o relație, dar nu justifică singur o intervenție."
  }),
  fixture(7, "no_obvious_angle", {
    title: "Biblioteca universitară își schimbă programul în august",
    summary: "Între 3 și 28 august, biblioteca este deschisă de luni până vineri între 09:00 și 15:00. Sala de lectură de la etajul al doilea rămâne închisă pentru reparații.",
    key_takeaways: ["Programul din august este 09:00–15:00, de luni până vineri."],
    conclusion: "Studenții pot folosi sala de la parter și serviciul de împrumut."
  }),
  fixture(8, "very_long", {
    title: "Ghid complet pentru tranziția de la catalogul pe hârtie la evidența digitală",
    summary: "Universitatea a documentat un proiect de nouă luni, de la inventarierea fluxurilor până la instruirea personalului și auditul accesului.",
    key_takeaways: ["Proiectul a durat nouă luni.", "Auditul accesului a fost făcut înaintea lansării."],
    sections: Array.from({ length: 12 }, (_, index) => ({ title: `Etapa ${index + 1}`, content: `Etapa ${index + 1} a definit responsabilitățile, datele necesare și criteriul de acceptare. Echipa a testat rezultatul cu două departamente înainte de extindere.`, keyClaims: [`Echipa a testat etapa ${index + 1} cu două departamente.`] })),
    conclusion: "Tranziția a fost tratată ca schimbare de proces, nu ca simplă instalare de software."
  }),
  fixture(9, "very_short", {
    title: "Înscrierile la workshop se închid vineri",
    summary: "Cele 40 de locuri sunt alocate în ordinea înscrierii.",
    key_takeaways: ["Workshopul are 40 de locuri."],
    conclusion: "Formularul se închide vineri la ora 18:00."
  }),
  fixture(10, "ambiguous", {
    title: "Un nou regulament ar putea schimba evaluarea",
    summary: "Senatul universitar a publicat un proiect aflat în consultare. Documentul propune două variante pentru ponderea examenului, fără să stabilească încă forma finală.",
    key_takeaways: ["Documentul este un proiect aflat în consultare.", "Forma finală nu este stabilită."],
    sections: [{ title: "Ce nu știm", content: "Data votului și varianta care va fi supusă aprobării nu au fost anunțate.", keyClaims: ["Data votului nu a fost anunțată."] }],
    conclusion: "Până la vot, regulile actuale rămân în vigoare."
  })
];
