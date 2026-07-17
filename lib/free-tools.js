const DAY_MS = 24 * 60 * 60 * 1000;

export const FREE_TOOLS_LAST_UPDATED = "2026-07-17";

export const freeTools = [
  {
    slug: "cate-grile-pe-zi",
    category: "Planificare",
    icon: "ListChecks",
    title: "Câte grile trebuie să fac pe zi?",
    shortTitle: "Grile pe zi",
    description: "Află câte grile noi și câte grile de repetat îți intră într-o zi de studiu.",
    seoTitle: "Calculator grile pe zi pentru examen | Nota 5+",
    seoDescription: "Calculează gratuit câte grile trebuie să rezolvi zilnic până la examen, inclusiv repetarea greșelilor.",
    directAnswer: "Împarte grilele rămase la zilele în care poți învăța, apoi adaugă repetările estimate pentru răspunsurile greșite.",
    cta: { label: "Exersează grilele pe materii", href: "/auth/login?next=/materii" },
    example: "Exemplu: la 800 de grile, 200 deja rezolvate, 30 de zile și 5 zile de studiu pe săptămână, planul pornește de la aproximativ 28 de grile noi pe zi de studiu."
  },
  {
    slug: "in-cate-zile-termin-materia",
    category: "Planificare",
    icon: "CalendarClock",
    title: "În câte zile termin materia?",
    shortTitle: "Termini materia",
    description: "Vezi data estimată la care închei materia și când să începi recapitularea.",
    seoTitle: "Calculator: în câte zile termini materia | Nota 5+",
    seoDescription: "Estimează gratuit data la care termini materia, în funcție de ritmul și zilele tale de studiu.",
    directAnswer: "Calculăm câte unități au rămas, le împărțim la ritmul zilnic și le așezăm în zilele disponibile de studiu.",
    cta: { label: "Transformă materialul într-un mod de studiu", href: "/auth/login?next=/materiale/invata" },
    example: "Exemplu: pentru 180 de pagini, cu 30 deja parcurse și 12 pagini pe zi, ai nevoie de 13 zile efective de studiu."
  },
  {
    slug: "plan-de-invatare",
    category: "Planificare",
    icon: "CalendarDays",
    title: "Plan de învățare până la examen",
    shortTitle: "Plan de învățare",
    description: "Generează un plan clar pe zile, cu recapitulare, simulări și o zi tampon înainte de examen.",
    seoTitle: "Generator gratuit de plan de învățare | Nota 5+",
    seoDescription: "Creează un plan de învățare până la examen, cu obiective zilnice, recapitulare și simulări.",
    directAnswer: "Planul rezervă ziua dinaintea examenului, distribuie materia în zilele disponibile și introduce recapitulări sau simulări la intervale previzibile.",
    cta: { label: "Creează teste din propria materie", href: "/auth/login?next=/materiale/invata" },
    example: "Exemplu: pentru 240 de grile, 45 de minute pe zi și 5 zile pe săptămână, planul împarte volumul în sesiuni scurte și lasă timp pentru recapitulare."
  },
  {
    slug: "calculator-punctaj-examen",
    category: "Examene și simulări",
    icon: "Calculator",
    title: "Calculator punctaj și notă la examen",
    shortTitle: "Punctaj examen",
    description: "Calculează punctajul brut, procentul, nota estimată și pragul următor.",
    seoTitle: "Calculator punctaj și notă examen | Nota 5+",
    seoDescription: "Calculează gratuit punctajul, procentul și nota estimată la un examen cu sau fără penalizări.",
    directAnswer: "Punctajul este răspunsurile corecte minus penalizarea pentru greșeli, plus punctele din oficiu; nota este raportată la punctajul maxim posibil.",
    cta: { label: "Începe o simulare completă", href: "/auth/login?next=/materii" },
    example: "Exemplu: 72 răspunsuri corecte, 18 greșite și 10 puncte din oficiu la un test de 100 de întrebări înseamnă 82 de puncte fără penalizare."
  },
  {
    slug: "scor-necesar-simulare",
    category: "Examene și simulări",
    icon: "TrendingUp",
    title: "De ce scor ai nevoie la următoarea simulare?",
    shortTitle: "Scor simulare",
    description: "Află ce scor sau medie trebuie să menții ca să ajungi la obiectivul ales.",
    seoTitle: "Calculator scor necesar la următoarea simulare | Nota 5+",
    seoDescription: "Calculează gratuit scorul necesar la următoarea simulare și verifică dacă media dorită este posibilă.",
    directAnswer: "Scădem punctele deja obținute din totalul necesar pentru media dorită și împărțim diferența la simulările rămase.",
    cta: { label: "Urmărește progresul în Nota 5+", href: "/auth/login?next=/materii" },
    example: "Exemplu: dacă ai media 64 după trei simulări și vrei media 75 după cinci, ai nevoie de o medie de 91 la ultimele două."
  }
];

export function getFreeTool(slug) {
  return freeTools.find((tool) => tool.slug === slug) || null;
}

function asNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function whole(value, fallback = 0) {
  return Math.max(0, Math.floor(asNumber(value, fallback)));
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function roundUpToFive(value) {
  return Math.ceil(value / 5) * 5;
}

function toDate(value) {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

export function formatDate(date) {
  return new Intl.DateTimeFormat("ro-RO", { day: "numeric", month: "long", year: "numeric" }).format(date);
}

export function dateInputValue(date = new Date()) {
  const local = toDate(date) || new Date();
  return `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, "0")}-${String(local.getDate()).padStart(2, "0")}`;
}

export function daysBetween(start, end) {
  return Math.floor((toDate(end).valueOf() - toDate(start).valueOf()) / DAY_MS);
}

export function studyDaysInRange(start, end, daysPerWeek) {
  const totalDays = Math.max(0, daysBetween(start, end));
  return Math.max(0, Math.floor(totalDays / 7) * daysPerWeek + Math.min(totalDays % 7, daysPerWeek));
}

export function addStudyDays(start, count, daysPerWeek) {
  const date = toDate(start) || new Date();
  const required = Math.max(0, whole(count));
  const available = clamp(whole(daysPerWeek, 5), 1, 7);
  let left = required;
  let guard = 0;

  while (left > 0 && guard < 4000) {
    if ((date.getDay() + 6) % 7 < available) {
      left -= 1;
    }
    if (left > 0) date.setDate(date.getDate() + 1);
    guard += 1;
  }

  return date;
}

function validateProgress(total, completed, label = "Volumul parcurs") {
  if (total <= 0) return "Introdu un volum total mai mare decât zero.";
  if (completed > total) return `${label} nu poate depăși volumul total.`;
  return null;
}

export function calculateDailyQuestions(input = {}) {
  const total = whole(input.totalQuestions);
  const solved = whole(input.solvedQuestions);
  const daysPerWeek = clamp(whole(input.daysPerWeek, 5), 0, 7);
  const repetitions = clamp(whole(input.repetitions, 1), 0, 10);
  const errorRate = clamp(asNumber(input.errorRate, 20), 0, 100);
  const today = toDate(input.today) || new Date();
  const examDate = toDate(input.examDate);
  const explicitDays = whole(input.daysRemaining);
  const error = validateProgress(total, solved, "Grilele deja rezolvate");

  if (error) return { ok: false, error };
  if (!daysPerWeek) return { ok: false, error: "Alege cel puțin o zi de studiu pe săptămână." };

  const calendarDays = examDate ? daysBetween(today, examDate) : explicitDays;
  if (calendarDays <= 0) return { ok: false, error: "Alege o dată de examen viitoare sau cel puțin o zi rămasă." };

  const studyDays = Math.max(1, Math.ceil((calendarDays * daysPerWeek) / 7));
  const remaining = total - solved;
  const estimatedWrong = Math.ceil(remaining * (errorRate / 100));
  const reviewTotal = estimatedWrong * repetitions;
  const newPerDay = Math.ceil(remaining / studyDays);
  const reviewPerDay = Math.ceil(reviewTotal / studyDays);
  const totalPerDay = newPerDay + reviewPerDay;
  const minutesPerDay = roundUpToFive(newPerDay * 0.8 + reviewPerDay * 0.45);
  const intensity = totalPerDay <= 30
    ? { label: "Ritm ușor", tone: "easy" }
    : totalPerDay <= 70
      ? { label: "Ritm realist", tone: "realistic" }
      : totalPerDay <= 120
        ? { label: "Ritm intens", tone: "intense" }
        : { label: "Ritm foarte dificil", tone: "hard" };
  const recommendation = totalPerDay > 120
    ? "Pentru un plan mai sustenabil, mărește numărul de zile de studiu, prelungește perioada sau redu repetările inițiale."
    : totalPerDay > 70
      ? "Ritmul este posibil dacă păstrezi sesiuni scurte și repeți greșelile în zile separate."
      : "Planul este echilibrat. Păstrează o zi liberă când simți că ai nevoie de recuperare.";

  return {
    ok: true,
    total,
    solved,
    remaining,
    studyDays,
    calendarDays,
    newPerDay,
    reviewPerDay,
    totalPerDay,
    minutesPerDay,
    estimatedWrong,
    reviewTotal,
    intensity,
    recommendation,
    formula: "Grile noi/zi = grile rămase ÷ zile de studiu. Repetări/zi = (grile rămase × procent greșeli × repetări) ÷ zile de studiu."
  };
}

export function calculateFinishDate(input = {}) {
  const total = whole(input.total);
  const completed = whole(input.completed);
  const dailyRate = whole(input.dailyRate);
  const daysPerWeek = clamp(whole(input.daysPerWeek, 5), 0, 7);
  const reviewDays = whole(input.reviewDays);
  const startDate = toDate(input.startDate) || new Date();
  const examDate = toDate(input.examDate);
  const error = validateProgress(total, completed, "Parcursul actual");

  if (error) return { ok: false, error };
  if (!dailyRate) return { ok: false, error: "Introdu câte unități poți parcurge într-o zi de studiu." };
  if (!daysPerWeek) return { ok: false, error: "Alege cel puțin o zi de studiu pe săptămână." };

  const remaining = total - completed;
  const studyDays = Math.ceil(remaining / dailyRate);
  const completionDate = addStudyDays(startDate, Math.max(studyDays, 1), daysPerWeek);
  const dayAfterCompletion = new Date(completionDate);
  dayAfterCompletion.setDate(dayAfterCompletion.getDate() + 1);
  const reviewStartDate = reviewDays ? addStudyDays(dayAfterCompletion, 1, daysPerWeek) : null;
  const finalDate = reviewDays ? addStudyDays(reviewStartDate, reviewDays, daysPerWeek) : completionDate;
  const calendarDays = Math.max(0, daysBetween(startDate, finalDate)) + 1;
  const exceedsExam = Boolean(examDate && finalDate > examDate);
  const availableStudyDays = examDate ? studyDaysInRange(startDate, examDate, daysPerWeek) : null;
  const recommendedRate = availableStudyDays && availableStudyDays > reviewDays
    ? Math.ceil(remaining / Math.max(1, availableStudyDays - reviewDays))
    : null;
  const recommendation = exceedsExam
    ? `Pentru a încheia înainte de examen, urcă ritmul la cel puțin ${recommendedRate || dailyRate + 1} unități pe zi de studiu sau adaugă zile de studiu.`
    : reviewDays
      ? `Începe recapitularea pe ${formatDate(reviewStartDate)} și păstrează cele ${reviewDays} zile doar pentru consolidare.`
      : "Planul se încheie fără zile rezervate pentru recapitulare. Adaugă 1–3 zile dacă examenul permite.";

  return {
    ok: true,
    remaining,
    studyDays,
    completionDate,
    reviewStartDate,
    finalDate,
    calendarDays,
    exceedsExam,
    recommendedRate,
    recommendation,
    formula: "Zile efective = unități rămase ÷ ritmul dintr-o zi de studiu. Data finală așază aceste zile într-o săptămână cu zilele de studiu selectate."
  };
}

const MATERIAL_RATES = {
  pagini: 3,
  capitole: 0.45,
  grile: 18
};

export function generateStudyPlan(input = {}) {
  const total = whole(input.total);
  const completed = whole(input.completed);
  const daysPerWeek = clamp(whole(input.daysPerWeek, 5), 0, 7);
  const minutesPerDay = whole(input.minutesPerDay, 45);
  const materialType = ["pagini", "capitole", "grile"].includes(input.materialType) ? input.materialType : "pagini";
  const difficulty = ["ușor", "mediu", "dificil"].includes(input.difficulty) ? input.difficulty : "mediu";
  const examDate = toDate(input.examDate);
  const today = toDate(input.today) || new Date();
  const wantsReview = input.wantsReview !== false;
  const wantsSimulations = Boolean(input.wantsSimulations);
  const error = validateProgress(total, completed, "Progresul actual");

  if (error) return { ok: false, error };
  if (!examDate || examDate <= today) return { ok: false, error: "Alege o dată de examen viitoare." };
  if (!daysPerWeek) return { ok: false, error: "Alege cel puțin o zi disponibilă pe săptămână." };
  if (minutesPerDay < 10) return { ok: false, error: "Alege cel puțin 10 minute disponibile pe zi." };

  const difficultyMultiplier = difficulty === "ușor" ? 1.25 : difficulty === "dificil" ? 0.75 : 1;
  const dailyVolume = Math.max(1, Math.floor((minutesPerDay / 30) * MATERIAL_RATES[materialType] * difficultyMultiplier));
  const remaining = total - completed;
  const bufferDate = new Date(examDate);
  bufferDate.setDate(bufferDate.getDate() - 1);
  const possibleDays = [];
  const cursor = new Date(today);
  cursor.setDate(cursor.getDate() + 1);

  while (cursor <= bufferDate && possibleDays.length < 150) {
    if ((cursor.getDay() + 6) % 7 < daysPerWeek) possibleDays.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  if (!possibleDays.length) return { ok: false, error: "Nu există o zi de studiu înainte de examen." };

  const reviewSlots = wantsReview ? Math.max(1, Math.floor(possibleDays.length / 5)) : 0;
  const simulationSlots = wantsSimulations ? Math.min(2, Math.max(1, Math.floor(possibleDays.length / 8))) : 0;
  const contentSlots = Math.max(1, possibleDays.length - reviewSlots - simulationSlots);
  const requiredContentDays = Math.ceil(remaining / dailyVolume);
  const fits = requiredContentDays <= contentSlots;
  const requiredDailyVolume = Math.ceil(remaining / contentSlots);
  const plan = [];
  let volumeLeft = remaining;
  let reviewLeft = reviewSlots;
  let simulationsLeft = simulationSlots;

  possibleDays.forEach((date, index) => {
    const remainingSlots = possibleDays.length - index;
    const reserveForReviewAndSimulations = reviewLeft + simulationsLeft;
    let type = "study";

    if (simulationsLeft && (index + 1) % Math.max(4, Math.floor(possibleDays.length / simulationsLeft)) === 0) {
      type = "simulation";
      simulationsLeft -= 1;
    } else if (reviewLeft && (index + 1) % 5 === 0 && remainingSlots > reserveForReviewAndSimulations) {
      type = "review";
      reviewLeft -= 1;
    } else if (volumeLeft <= 0 && reviewLeft) {
      type = "review";
      reviewLeft -= 1;
    }

    const volume = type === "study" ? Math.min(dailyVolume, volumeLeft) : 0;
    if (type === "study") volumeLeft -= volume;
    const label = type === "study"
      ? `${volume} ${materialType}`
      : type === "review"
        ? "Recapitulare: greșeli, noțiuni dificile și rezumat"
        : "Simulare scurtă și analiză a greșelilor";
    plan.push({ date, type, volume, label });
  });

  const visiblePlan = plan.slice(0, 42);
  return {
    ok: true,
    materialType,
    remaining,
    dailyVolume,
    requiredDailyVolume,
    fits,
    plan: visiblePlan,
    hiddenDays: Math.max(0, plan.length - visiblePlan.length),
    reviewSlots,
    simulationSlots,
    bufferDate,
    recommendation: fits
      ? `Planul lasă ${reviewSlots} sesiuni de recapitulare${simulationSlots ? ` și ${simulationSlots} simulări` : ""}, plus ziua tampon dinaintea examenului.`
      : `La timpul disponibil, materia nu încape înainte de examen. Ai nevoie de aproximativ ${requiredDailyVolume} ${materialType} pe zi de studiu, nu ${dailyVolume}.`,
    formula: `Volum/zi = (minute disponibile ÷ 30) × ritmul de ${MATERIAL_RATES[materialType]} ${materialType}/30 min, ajustat pentru dificultate. Ziua dinaintea examenului este păstrată ca tampon.`
  };
}

export function calculateExamScore(input = {}) {
  const total = whole(input.totalQuestions);
  const correct = whole(input.correct);
  const wrong = whole(input.wrong);
  const skipped = whole(input.skipped);
  const basePoints = Math.max(0, asNumber(input.basePoints, 0));
  const maxGrade = Math.max(1, asNumber(input.maxGrade, 10));
  const passGrade = clamp(asNumber(input.passGrade, 5), 0, maxGrade);
  const penalty = Math.max(0, asNumber(input.penalty, 0));

  if (!total) return { ok: false, error: "Introdu numărul total de întrebări." };
  if (correct + wrong + skipped !== total) return { ok: false, error: "Răspunsurile corecte, greșite și necompletate trebuie să însumeze numărul total de întrebări." };

  const rawPoints = Math.max(0, correct - wrong * penalty + basePoints);
  const maximumPoints = total + basePoints;
  const percentage = clamp((rawPoints / maximumPoints) * 100, 0, 100);
  const grade = (percentage / 100) * maxGrade;
  const passed = grade >= passGrade;
  const nextWholeGrade = Math.min(maxGrade, Math.floor(grade) + (Number.isInteger(grade) ? 1 : 1));
  const nextThresholdPoints = (nextWholeGrade / maxGrade) * maximumPoints;
  const gainFromFixingWrong = 1 + penalty;
  const questionsForNextThreshold = nextWholeGrade > grade
    ? Math.max(0, Math.ceil((nextThresholdPoints - rawPoints) / gainFromFixingWrong))
    : 0;

  return {
    ok: true,
    rawPoints,
    maximumPoints,
    percentage,
    grade,
    passed,
    nextWholeGrade,
    questionsForNextThreshold,
    formula: `Punctaj brut = corecte (${correct}) − greșite (${wrong}) × penalizare (${penalty}) + puncte din oficiu (${basePoints}). Nota = punctaj brut ÷ punctaj maxim × ${maxGrade}.`
  };
}

export function calculateRequiredSimulationScore(input = {}) {
  const scores = Array.isArray(input.scores)
    ? input.scores.map((score) => asNumber(score, NaN)).filter((score) => Number.isFinite(score) && score >= 0 && score <= 100)
    : [];
  const targetAverage = clamp(asNumber(input.targetAverage, 75), 0, 100);
  const plannedTotal = whole(input.plannedTotal);
  const remaining = whole(input.remaining);

  if (!plannedTotal) return { ok: false, error: "Introdu numărul total de simulări planificate." };
  if (!remaining) return { ok: false, error: "Introdu câte simulări mai ai de făcut." };
  if (scores.length + remaining !== plannedTotal) return { ok: false, error: "Simulările anterioare și cele rămase trebuie să însumeze totalul planificat." };

  const currentAverage = scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0;
  const requiredTotal = targetAverage * plannedTotal;
  const collected = scores.reduce((sum, score) => sum + score, 0);
  const requiredAverage = (requiredTotal - collected) / remaining;
  const possible = requiredAverage >= 0 && requiredAverage <= 100;
  const nextScore = clamp(requiredAverage, 0, 100);
  const trend = scores.length < 2
    ? "Nu sunt încă suficiente scoruri pentru un trend."
    : scores.at(-1) - scores[0] >= 5
      ? "Trend în urcare: ultimul scor este cu cel puțin 5 puncte peste primul."
      : scores.at(-1) - scores[0] <= -5
        ? "Trend în scădere: merită să revezi greșelile înainte de următoarea simulare."
        : "Trend stabil: scorurile variază puțin față de primul rezultat.";

  return {
    ok: true,
    currentAverage,
    targetAverage,
    requiredAverage,
    nextScore,
    possible,
    trend,
    recommendation: possible
      ? `Pentru țintă, menține o medie de cel puțin ${requiredAverage.toFixed(1)} la următoarele ${remaining} simulări.`
      : "Ținta nu mai este matematic posibilă cu scoruri de maximum 100. Poți ajusta media dorită sau numărul de simulări planificate.",
    formula: "Media necesară = (media dorită × numărul total de simulări − suma scorurilor actuale) ÷ simulările rămase."
  };
}
