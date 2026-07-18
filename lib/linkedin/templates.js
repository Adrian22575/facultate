export const LINKEDIN_POST_TEMPLATES = [
  {
    key: "practical_brief",
    label: "Pe scurt, ce contează",
    description: "Un rezumat clar, util pentru oameni ocupați.",
    prompt: "Deschide cu ideea practică importantă. Continuă cu cel mult două paragrafe scurte: ce s-a schimbat și ce merită urmărit."
  },
  {
    key: "what_changes",
    label: "Ce se schimbă",
    description: "Pune schimbarea și efectul ei în prim-plan.",
    prompt: "Începe cu schimbarea concretă. Separă clar contextul, efectul probabil și următorul pas util, fără ton alarmist."
  },
  {
    key: "three_takeaways",
    label: "3 idei de reținut",
    description: "O postare scanabilă, cu trei repere concise.",
    prompt: "După un început de maximum două propoziții, folosește exact trei repere scurte, fiecare pe rând propriu și introdus cu «•»."
  },
  {
    key: "professional_angle",
    label: "Perspectivă profesională",
    description: "Leagă faptele de o concluzie prudentă.",
    prompt: "Pornește de la un fapt verificabil și explică de ce merită urmărit de profesori, studenți sau echipe care construiesc produse educaționale."
  },
  {
    key: "conversation_starter",
    label: "Deschide conversația",
    description: "O idee clară urmată de o întrebare specifică.",
    prompt: "Începe cu o observație directă, dezvoltă pe scurt implicația și încheie cu o întrebare concretă care invită la exemple sau soluții."
  }
];

export const LINKEDIN_POST_TEMPLATE_KEYS = LINKEDIN_POST_TEMPLATES.map((template) => template.key);
export const DEFAULT_LINKEDIN_POST_TEMPLATE = "practical_brief";

export function getLinkedInPostTemplate(value) {
  return LINKEDIN_POST_TEMPLATES.find((template) => template.key === value)
    || LINKEDIN_POST_TEMPLATES.find((template) => template.key === DEFAULT_LINKEDIN_POST_TEMPLATE);
}
