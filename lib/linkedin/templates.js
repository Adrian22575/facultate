function findOption(options, value, fallback) {
  return options.find((option) => option.key === value)
    || options.find((option) => option.key === fallback);
}

export const LINKEDIN_POST_OBJECTIVES = [
  { key: "authority", label: "Construire de autoritate", description: "Demonstrează discernământ printr-o idee bine susținută." },
  { key: "education", label: "Educare", description: "Face o idee dificilă ușor de înțeles și aplicat." },
  { key: "comments", label: "Comentarii", description: "Deschide o discuție concretă, la care cititorul poate contribui." },
  { key: "traffic", label: "Trafic către articol", description: "Oferă valoare în postare și păstrează un motiv real pentru click." },
  { key: "leads", label: "Lead-uri", description: "Leagă problema de o conversație utilă, fără presiune comercială." },
  { key: "promotion", label: "Produs sau serviciu", description: "Arată utilitatea prin problemă și rezultat, fără reclamă agresivă." },
  { key: "opinion", label: "Împărtășirea unei opinii", description: "Susține o poziție clară, credibilă și deschisă nuanțelor." },
  { key: "lesson", label: "Prezentarea unei lecții", description: "Transformă articolul într-o concluzie aplicabilă." },
  { key: "achievement", label: "Prezentarea unei realizări", description: "Explică munca și semnificația rezultatului fără triumfalism." },
  { key: "personal_brand", label: "Personal branding", description: "Consolidează vocea autorului printr-o perspectivă recognoscibilă." }
];

export const LINKEDIN_POST_TEMPLATES = [
  { key: "opinion", label: "Opinie", description: "O poziție argumentată pornind de la o singură idee." },
  { key: "lesson", label: "Lecție", description: "O concluzie utilă și transferabilă." },
  { key: "story", label: "Poveste", description: "O succesiune narativă bazată numai pe fapte disponibile." },
  { key: "case_study", label: "Studiu de caz", description: "Context, decizie, rezultat și implicație." },
  { key: "analysis", label: "Analiză", description: "Explică tensiunea și consecința unei schimbări." },
  { key: "educational", label: "Explicație educațională", description: "Clarifică o idee fără jargon și fără simplificări false." },
  { key: "practical_list", label: "Listă practică", description: "Repere scurte, specifice și ușor de salvat." },
  { key: "framework", label: "Framework", description: "Un model de gândire reutilizabil." },
  { key: "debate", label: "Întrebare sau dezbatere", description: "Construiește o întrebare dificilă pe dovezi reale." },
  { key: "short_post", label: "Postare scurtă", description: "O idee puternică în puține paragrafe." },
  { key: "long_post", label: "Postare amplă", description: "O argumentație dezvoltată, ușor de scanat pe mobil." }
];

export const LINKEDIN_POST_VOICES = [
  { key: "direct_lucid", label: "Direct și lucid", description: "Spune ideea fără introduceri și fără decor inutil." },
  { key: "professional_human", label: "Profesional, dar uman", description: "Competent, cald și lipsit de limbaj corporatist." },
  { key: "provocative_credible", label: "Provocator, dar credibil", description: "Testează o presupunere fără conflict inventat." },
  { key: "educational_simple", label: "Educațional și simplu", description: "Explică limpede, cu exemple și termeni accesibili." },
  { key: "personal_reflective", label: "Personal și reflexiv", description: "Apropiat, fără experiențe personale inventate." },
  { key: "analytical", label: "Analitic", description: "Păstrează nuanțele și explică implicațiile." },
  { key: "conversational", label: "Conversațional", description: "Sună natural, fără familiaritate forțată." },
  { key: "authoritative", label: "Autoritar", description: "Sigur pe explicație, prudent cu limitele dovezilor." },
  { key: "optimistic_grounded", label: "Optimist, fără exagerare", description: "Arată oportunitatea și costurile reale." },
  { key: "constructive_critical", label: "Critic constructiv", description: "Numește problema și propune o direcție utilă." }
];

export const LINKEDIN_POST_AUDIENCES = [
  { key: "professionals", label: "Profesioniști", description: "Oameni care vor idei aplicabile în munca lor." },
  { key: "managers", label: "Manageri", description: "Cititori care iau decizii și coordonează echipe." },
  { key: "entrepreneurs", label: "Antreprenori", description: "Fondatori atenți la risc, viteză și oportunitate." },
  { key: "ai_specialists", label: "Specialiști AI", description: "Cititori tehnici care apreciază precizia și limitele." },
  { key: "educators", label: "Educatori", description: "Profesori și oameni implicați direct în învățare." },
  { key: "leaders", label: "Lideri", description: "Decidenți interesați de direcție și consecințe." },
  { key: "hr", label: "HR", description: "Profesioniști interesați de oameni, roluri și adopție." },
  { key: "digitalization", label: "Digitalizare", description: "Echipe care schimbă procese și instrumente." },
  { key: "general", label: "Public general", description: "Cititori fără context tehnic obligatoriu." },
  { key: "custom", label: "Audiență personalizată", description: "Definește exact rolul sau comunitatea vizată." }
];

export const LINKEDIN_POST_CTAS = [
  { key: "auto", label: "Automat", description: "Alege acțiunea numai dacă întărește postarea." },
  { key: "comment", label: "Să comenteze", description: "Folosește o întrebare specifică și ușor de abordat." },
  { key: "click", label: "Să acceseze articolul", description: "Păstrează pentru articol o extensie clară a ideii." },
  { key: "save", label: "Să salveze", description: "Oferă un reper care merită recitit." },
  { key: "share", label: "Să distribuie", description: "Formulează o explicație utilă unei echipe sau comunități." },
  { key: "message", label: "Să trimită mesaj", description: "Invită la o discuție concretă, fără presiune." },
  { key: "test_product", label: "Să testeze produsul", description: "Leagă produsul de o problemă demonstrată." },
  { key: "none", label: "Fără CTA explicit", description: "Încheie cu ideea, fără o cerere adresată cititorului." }
];

export const LINKEDIN_POST_NARRATIVES = [
  { key: "first_person", label: "Persoana întâi", description: "Folosește «eu» doar pentru fapte furnizate explicit." },
  { key: "company", label: "Perspectiva companiei", description: "Vocea echipei, fără formulări de comunicat." },
  { key: "neutral_editorial", label: "Neutru editorial", description: "Perspectivă prudentă, centrată pe dovezi." },
  { key: "expert", label: "Expert", description: "Explicație fermă, cu limitele informației la vedere." },
  { key: "founder", label: "Fondator", description: "Perspectivă de decizie, numai cu experiențe documentate." },
  { key: "educator", label: "Educator", description: "Explică prin întrebări și exemple aplicabile." }
];

export const LINKEDIN_POST_LENGTHS = [
  { key: "auto", label: "Automată", description: "Alege lungimea după articol, tip și scop." },
  { key: "short", label: "Scurtă", description: "Aproximativ 350–650 de caractere." },
  { key: "medium", label: "Medie", description: "Aproximativ 650–1.200 de caractere." },
  { key: "long", label: "Lungă", description: "Aproximativ 1.200–2.200 de caractere." }
];

export const LINKEDIN_POST_LINK_PLACEMENTS = [
  { key: "natural", label: "Inclus natural", description: "Linkul apare într-o frază potrivită contextului." },
  { key: "end", label: "La final", description: "Linkul stă separat după concluzie și hashtaguri." },
  { key: "first_comment", label: "În primul comentariu", description: "Postarea rămâne fără link; comentariul se publică după postare." },
  { key: "none", label: "Fără link", description: "Postarea funcționează independent de articol." }
];

export const DEFAULT_LINKEDIN_POST_OBJECTIVE = "authority";
export const DEFAULT_LINKEDIN_POST_TEMPLATE = "lesson";
export const DEFAULT_LINKEDIN_POST_VOICE = "professional_human";
export const DEFAULT_LINKEDIN_POST_AUDIENCE = "professionals";
export const DEFAULT_LINKEDIN_POST_CTA = "auto";
export const DEFAULT_LINKEDIN_POST_NARRATIVE = "neutral_editorial";
export const DEFAULT_LINKEDIN_POST_LENGTH = "auto";
export const DEFAULT_LINKEDIN_POST_LINK_PLACEMENT = "end";

export const LINKEDIN_POST_OBJECTIVE_KEYS = LINKEDIN_POST_OBJECTIVES.map(({ key }) => key);
export const LINKEDIN_POST_TEMPLATE_KEYS = LINKEDIN_POST_TEMPLATES.map(({ key }) => key);
export const LINKEDIN_POST_VOICE_KEYS = LINKEDIN_POST_VOICES.map(({ key }) => key);
export const LINKEDIN_POST_AUDIENCE_KEYS = LINKEDIN_POST_AUDIENCES.map(({ key }) => key);
export const LINKEDIN_POST_CTA_KEYS = LINKEDIN_POST_CTAS.map(({ key }) => key);
export const LINKEDIN_POST_NARRATIVE_KEYS = LINKEDIN_POST_NARRATIVES.map(({ key }) => key);
export const LINKEDIN_POST_LENGTH_KEYS = LINKEDIN_POST_LENGTHS.map(({ key }) => key);
export const LINKEDIN_POST_LINK_PLACEMENT_KEYS = LINKEDIN_POST_LINK_PLACEMENTS.map(({ key }) => key);

export const getLinkedInPostObjective = (value) => findOption(LINKEDIN_POST_OBJECTIVES, value, DEFAULT_LINKEDIN_POST_OBJECTIVE);
export const getLinkedInPostTemplate = (value) => findOption(LINKEDIN_POST_TEMPLATES, value, DEFAULT_LINKEDIN_POST_TEMPLATE);
export const getLinkedInPostVoice = (value) => findOption(LINKEDIN_POST_VOICES, value, DEFAULT_LINKEDIN_POST_VOICE);
export const getLinkedInPostAudience = (value) => findOption(LINKEDIN_POST_AUDIENCES, value, DEFAULT_LINKEDIN_POST_AUDIENCE);
export const getLinkedInPostCta = (value) => findOption(LINKEDIN_POST_CTAS, value, DEFAULT_LINKEDIN_POST_CTA);
export const getLinkedInPostNarrative = (value) => findOption(LINKEDIN_POST_NARRATIVES, value, DEFAULT_LINKEDIN_POST_NARRATIVE);
export const getLinkedInPostLength = (value) => findOption(LINKEDIN_POST_LENGTHS, value, DEFAULT_LINKEDIN_POST_LENGTH);
export const getLinkedInPostLinkPlacement = (value) => findOption(LINKEDIN_POST_LINK_PLACEMENTS, value, DEFAULT_LINKEDIN_POST_LINK_PLACEMENT);

export function normalizeLinkedInGenerationOptions(value = {}) {
  const audience = getLinkedInPostAudience(value.audienceKey);
  return {
    objectiveKey: getLinkedInPostObjective(value.objectiveKey).key,
    templateKey: getLinkedInPostTemplate(value.templateKey).key,
    voiceKey: getLinkedInPostVoice(value.voiceKey).key,
    audienceKey: audience.key,
    customAudience: audience.key === "custom" ? String(value.customAudience || "").trim().slice(0, 180) : "",
    ctaKey: getLinkedInPostCta(value.ctaKey).key,
    narrativeKey: getLinkedInPostNarrative(value.narrativeKey).key,
    lengthKey: getLinkedInPostLength(value.lengthKey).key,
    linkPlacementKey: getLinkedInPostLinkPlacement(value.linkPlacementKey).key
  };
}
