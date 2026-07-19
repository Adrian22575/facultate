export const LINKEDIN_PROMPT_VERSION = "linkedin-post-generator-v2";

export const BANNED_LINKEDIN_PHRASES = [
  "în lumea dinamică de astăzi",
  "în peisajul digital actual",
  "într-un peisaj în continuă schimbare",
  "este mai important ca niciodată",
  "nu o să îți vină să crezi",
  "acest lucru va schimba totul",
  "sunt încântat să împărtășesc",
  "sunt mândru să împărtășesc",
  "game changer",
  "schimbă regulile jocului",
  "revoluționar",
  "deblochează potențialul",
  "valorifică puterea",
  "viitorul este deja aici",
  "let that sink in",
  "full stop",
  "plot twist",
  "spoiler",
  "unlock the power",
  "excited to announce",
  "proud to share",
  "dive deep",
  "key takeaways",
  "transformative",
  "cutting-edge",
  "seamless",
  "paradigm shift"
];

export const BANNED_LINKEDIN_PATTERNS = [
  /(?:iată|uite) (?:de ce|ce|cum)\b/i,
  /adevărul (?:incomod|este)\b/i,
  /(?:nu|n-)\s+[^.!?]{2,80}[.!?]\s+(?:ci|este)\s+/i,
  /(?:problema|răspunsul|întrebarea) nu (?:este|e) [^.!?]+[.!?]\s+(?:problema|răspunsul|întrebarea|este|e)\b/i,
  /(?:acest lucru|asta) contează pentru că/i,
  /(?:gândește-te|hai să vorbim)\b/i,
  /(?:tu ce părere ai|scrie în comentarii|dă like și distribuie|link în comentarii|sunt curios să aud)/i,
  /\b(?:leverage|foster|empower|robust)\b/i
];

function normalize(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("ro");
}

export function findBannedLinkedInLanguage(value) {
  const text = String(value || "");
  const normalized = normalize(text);
  const phrases = BANNED_LINKEDIN_PHRASES.filter((phrase) => normalized.includes(normalize(phrase)));
  const patterns = BANNED_LINKEDIN_PATTERNS.filter((pattern) => pattern.test(text)).map((_, index) => `pattern_${index + 1}`);
  return [...phrases, ...patterns];
}
