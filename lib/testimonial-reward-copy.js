export const TESTIMONIAL_REWARD_QUESTIONS = [
  {
    key: "stress_thought",
    label: "Care era cel mai stresant gand pe care il aveai cand te gandeai la examen?"
  },
  {
    key: "fear_if_failed",
    label: "De ce iti era cel mai frica daca nu reuseai sa iei examenul?"
  },
  {
    key: "learning_frustration",
    label:
      "Care era cea mai mare frustrare pentru tine cand incercai sa inveti din cursuri, PDF-uri sau poze cu materia?"
  },
  {
    key: "needed_help",
    label: "Ce ti-ar fi prins bine ca sa nu mai simti atata stres inainte de examen?"
  },
  {
    key: "after_platform",
    label:
      "Acum, dupa ce ai folosit platforma, ce s-a schimbat in felul in care te simti fata de examen?"
  }
];

export const TESTIMONIAL_REWARD_MIN_ANSWER_LENGTH = 20;

export const TESTIMONIAL_REWARD_OPTIONS = {
  ai_upload_1: {
    label: "O incarcare gratuita",
    shortLabel: "Incarcare gratuita"
  },
  premium_24h: {
    label: "Acces gratuit 24h",
    shortLabel: "24h premium"
  }
};

function cleanSentence(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.!?]+$/g, "");
}

function sentence(value, fallback) {
  const cleaned = cleanSentence(value);
  return cleaned || fallback;
}

export function buildTestimonialDraft(answers) {
  const stressThought = sentence(
    answers?.stress_thought,
    "nu stiam daca voi reusi sa acopar materia la timp"
  );
  const fearIfFailed = sentence(
    answers?.fear_if_failed,
    "as pierde timp si as intra in examen cu si mai multa presiune"
  );
  const learningFrustration = sentence(
    answers?.learning_frustration,
    "informatia era imprastiata si greu de transformat in intrebari clare"
  );
  const neededHelp = sentence(
    answers?.needed_help,
    "un mod mai simplu de a transforma materia in exercitiu concret"
  );
  const afterPlatform = sentence(
    answers?.after_platform,
    "ma simt mai organizat si mai sigur pe ce am de repetat"
  );

  return [
    `Inainte de examen simteam ca ${stressThought}, iar teama ca ${fearIfFailed} imi punea si mai multa presiune.`,
    `Cel mai greu era sa transform materia intr-un plan clar, pentru ca ${learningFrustration}.`,
    `Aveam nevoie de ${neededHelp}, nu doar de inca o lista de cursuri prin care sa ma pierd.`,
    `Dupa ce am folosit platforma, ${afterPlatform}. M-a ajutat sa vad mai clar ce stiu, ce mai trebuie repetat si sa intru in pregatire cu mai multa liniste.`
  ].join(" ");
}
