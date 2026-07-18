export const LINKEDIN_POST_TEMPLATES = [
  {
    key: "what_matters_now",
    label: "Ce contează acum",
    description: "O noutate explicată prin consecința ei practică.",
    prompt: "Deschide cu schimbarea concretă și explică de ce contează acum pentru oamenii afectați. Nu repeta titlul articolului și nu transforma postarea într-un comunicat."
  },
  {
    key: "point_of_view",
    label: "Un punct de vedere",
    description: "O idee argumentată, concepută pentru conversație.",
    prompt: "Pornește de la o afirmație clară și ușor contraintuitivă, susținută strict de articol. Explică nuanța, fără dramatizare sau opinii inventate."
  },
  {
    key: "practical_checklist",
    label: "3 pași concreți",
    description: "Un reper rapid, bun pentru salvare și aplicare.",
    prompt: "Transformă o idee în exact trei repere acționabile. Fiecare reper trebuie să fie scurt, specific și util pentru elevi, studenți, profesori sau echipe educaționale."
  },
  {
    key: "clear_observation",
    label: "O observație clară",
    description: "O explicație umană, fără ton solemn sau corporatist.",
    prompt: "Scoate în față o observație pe care cititorul o poate recunoaște imediat. Scrie natural și concret, fără a pretinde experiențe personale care nu apar în articol."
  },
  {
    key: "data_explained",
    label: "Date pe înțeles",
    description: "Un fapt verificabil și interpretarea lui practică.",
    prompt: "Alege un singur fapt sau o singură cifră susținută de articol. Explică simplu ce înseamnă și unde ar fi greșit să tragem concluzii prea repede."
  }
];

export const LINKEDIN_POST_TEMPLATE_KEYS = LINKEDIN_POST_TEMPLATES.map((template) => template.key);
export const DEFAULT_LINKEDIN_POST_TEMPLATE = "what_matters_now";

export const LINKEDIN_POST_OBJECTIVES = [
  { key: "conversation", label: "Conversație", description: "Încurajează comentarii cu o întrebare concretă." },
  { key: "traffic", label: "Vizite la articol", description: "Conduce natural cititorul către analiza completă." },
  { key: "credibility", label: "Credibilitate", description: "Pune în valoare o explicație utilă și bine argumentată." }
];

export const LINKEDIN_POST_OBJECTIVE_KEYS = LINKEDIN_POST_OBJECTIVES.map((objective) => objective.key);
export const DEFAULT_LINKEDIN_POST_OBJECTIVE = "credibility";

export const LINKEDIN_POST_VOICES = [
  { key: "direct", label: "Direct", description: "Scurt, limpede și fără introduceri." },
  { key: "teacher_practitioner", label: "Profesor-practician", description: "Explică simplu, cu utilitate imediată." },
  { key: "analytical", label: "Analitic", description: "Păstrează nuanța și explică implicațiile." },
  { key: "conversational", label: "Conversațional", description: "Natural și apropiat, fără familiaritate forțată." }
];

export const LINKEDIN_POST_VOICE_KEYS = LINKEDIN_POST_VOICES.map((voice) => voice.key);
export const DEFAULT_LINKEDIN_POST_VOICE = "direct";

export function getLinkedInPostTemplate(value) {
  return LINKEDIN_POST_TEMPLATES.find((template) => template.key === value)
    || LINKEDIN_POST_TEMPLATES.find((template) => template.key === DEFAULT_LINKEDIN_POST_TEMPLATE);
}

export function getLinkedInPostObjective(value) {
  return LINKEDIN_POST_OBJECTIVES.find((objective) => objective.key === value)
    || LINKEDIN_POST_OBJECTIVES.find((objective) => objective.key === DEFAULT_LINKEDIN_POST_OBJECTIVE);
}

export function getLinkedInPostVoice(value) {
  return LINKEDIN_POST_VOICES.find((voice) => voice.key === value)
    || LINKEDIN_POST_VOICES.find((voice) => voice.key === DEFAULT_LINKEDIN_POST_VOICE);
}
