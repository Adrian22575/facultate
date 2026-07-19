export const ADMIN_ROUTE_GROUPS = [
  {
    id: "content",
    label: "Conținut",
    description: "Publicare și distribuire",
    routes: [
      { id: "articles", path: "/admin/continut/articole", label: "Articole", description: "Generare, revizuire și publicare editorială.", icon: "newspaper", kind: "editorial", pane: "article" },
      { id: "linkedin", path: "/admin/continut/linkedin", label: "LinkedIn", description: "Variante, aprobări și publicări LinkedIn.", icon: "send", kind: "editorial", pane: "linkedin" },
      { id: "dictionary", path: "/admin/continut/dictionar", label: "Dicționar", description: "Termeni, automatizare și control editorial.", icon: "book", kind: "dictionary" }
    ]
  },
  {
    id: "community",
    label: "Comunitate",
    description: "Oameni și mesaje",
    routes: [
      { id: "feedback", path: "/admin/comunitate/feedback", label: "Feedback", description: "Probleme, cerințe și idei trimise din aplicație.", icon: "message", kind: "platform", section: "feedback" },
      { id: "testimonials", path: "/admin/comunitate/testimoniale", label: "Testimoniale", description: "Aprobări și recompense pentru review-uri.", icon: "star", kind: "platform", section: "testimonials" },
      { id: "users", path: "/admin/comunitate/utilizatori", label: "Utilizatori", description: "Conturi, onboarding și apartenență academică.", icon: "users", kind: "platform", section: "users" },
      { id: "free-access", path: "/admin/comunitate/acces-gratuit", label: "Acces gratuit", description: "Granturi premium acordate manual.", icon: "key", kind: "platform", section: "free-access" }
    ]
  },
  {
    id: "catalog",
    label: "Catalog academic",
    description: "Structura educațională",
    routes: [
      { id: "subjects", path: "/admin/catalog/materii", label: "Materii", description: "Catalogul materiilor și alocările lor.", icon: "graduation", kind: "platform", section: "subjects" },
      { id: "institutions", path: "/admin/catalog/institutii", label: "Instituții", description: "Universități, școli și comunitățile aferente.", icon: "building", kind: "platform", section: "academic", academicView: "institutions" },
      { id: "faculties", path: "/admin/catalog/facultati", label: "Facultăți", description: "Facultăți, programe și dependențe academice.", icon: "school", kind: "platform", section: "academic", academicView: "faculties" }
    ]
  },
  {
    id: "finance",
    label: "Financiar",
    description: "Plăți și beneficii",
    routes: [
      { id: "subscriptions", path: "/admin/financiar/abonamente", label: "Abonamente", description: "Granturi premium și perioade de valabilitate.", icon: "shield", kind: "platform", section: "billing", billingView: "premium" },
      { id: "credits", path: "/admin/financiar/credite", label: "Credite", description: "Pachete cumpărate și încărcări acordate.", icon: "credit-card", kind: "platform", section: "billing", billingView: "credits" },
      { id: "payment-events", path: "/admin/financiar/evenimente-plati", label: "Evenimente plăți", description: "Webhook-uri și erori de sincronizare Stripe.", icon: "receipt", kind: "platform", section: "billing", billingView: "webhooks" }
    ]
  },
  {
    id: "operations",
    label: "Operațiuni",
    description: "Sănătatea proceselor",
    routes: [
      { id: "processing", path: "/admin/operatiuni/procesari", label: "Procesări", description: "Cereri, costuri, durate și erori tehnice.", icon: "server", kind: "processing" },
      { id: "failed-uploads", path: "/admin/operatiuni/incarcari-esuate", label: "Încărcări eșuate", description: "Fișiere care necesită diagnostic sau reluare.", icon: "alert", kind: "uploads" }
    ]
  },
  {
    id: "analytics",
    label: "Analiză",
    description: "Utilizare și adopție",
    routes: [
      { id: "usage", path: "/admin/analize/utilizare", label: "Utilizare", description: "Activitate, funnel-uri și materiale recente.", icon: "chart", kind: "platform", section: "analytics" }
    ]
  }
];

export const ADMIN_ROUTES = ADMIN_ROUTE_GROUPS.flatMap((group) =>
  group.routes.map((route) => ({ ...route, groupId: group.id, groupLabel: group.label }))
);

export function getAdminRoute(pathOrSegments) {
  const path = Array.isArray(pathOrSegments)
    ? `/admin/${pathOrSegments.map((part) => String(part || "").trim()).filter(Boolean).join("/")}`
    : String(pathOrSegments || "").replace(/\/+$/, "");
  return ADMIN_ROUTES.find((route) => route.path === path) || null;
}

function singleValue(value) {
  return Array.isArray(value) ? value[0] || "" : String(value || "");
}

export function getLegacyAdminDestination(source = {}) {
  const adminTab = singleValue(source.admin_tab);
  if (adminTab === "processing" || adminTab === "openai") return "/admin/operatiuni/procesari";
  if (adminTab === "uploads") return "/admin/operatiuni/incarcari-esuate";
  if (adminTab === "dictionary") return "/admin/continut/dictionar";
  if (adminTab === "editorial") return source.linkedin_post ? "/admin/continut/linkedin" : "/admin/continut/articole";

  const section = singleValue(source.section);
  if (section === "editorial") return source.linkedin_post ? "/admin/continut/linkedin" : "/admin/continut/articole";
  if (section === "dictionary") return "/admin/continut/dictionar";
  if (section === "processing" || section === "openai") return "/admin/operatiuni/procesari";
  if (section === "uploads") return "/admin/operatiuni/incarcari-esuate";
  if (section === "billing") {
    const billing = singleValue(source.billing);
    if (billing === "credits") return "/admin/financiar/credite";
    if (billing === "webhooks") return "/admin/financiar/evenimente-plati";
    return "/admin/financiar/abonamente";
  }
  if (section === "users") return "/admin/comunitate/utilizatori";
  if (section === "subjects") return "/admin/catalog/materii";
  if (section === "academic") return singleValue(source.academic_tab) === "faculties" ? "/admin/catalog/facultati" : "/admin/catalog/institutii";
  if (section === "free-access") return "/admin/comunitate/acces-gratuit";
  if (section === "testimonials") return "/admin/comunitate/testimoniale";
  if (section === "analytics") return "/admin/analize/utilizare";
  if (section === "feedback") return "/admin/comunitate/feedback";
  return null;
}

export function getLegacyAdminRedirect(source = {}) {
  const destination = getLegacyAdminDestination(source);
  if (!destination) return null;

  const params = new URLSearchParams();
  for (const [key, rawValue] of Object.entries(source)) {
    if (["admin_tab", "section", "billing", "academic_tab"].includes(key)) continue;
    const value = singleValue(rawValue);
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `${destination}?${query}` : destination;
}
