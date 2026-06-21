import "server-only";

const STOP_WORDS = new Set([
  "acest",
  "acesta",
  "aceasta",
  "aceste",
  "acesti",
  "ale",
  "are",
  "care",
  "cele",
  "celor",
  "este",
  "fara",
  "fiind",
  "intr",
  "intre",
  "mai",
  "mult",
  "prin",
  "sau",
  "sunt",
  "unei",
  "unor",
  "pentru",
  "poate",
  "trebuie",
  "asupra",
  "dintre",
  "acestea",
  "respectiv"
]);

function cleanText(value) {
  return String(value || "")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitSentences(text) {
  return cleanText(text)
    .split(/(?<=[.!?])\s+|\n+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 28)
    .slice(0, 80);
}

function titleCase(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function normalizeDedupeKey(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function reindexItems(items) {
  return items.map((item, index) => ({
    ...item,
    position: index + 1
  }));
}

function detectChapterBlocks(text) {
  const normalized = cleanText(text);
  const lines = normalized.split("\n").map((line) => line.trim()).filter(Boolean);
  const headingIndexes = [];

  lines.forEach((line, index) => {
    const isNumberedHeading = /^(capitolul|cap\.?|unitatea|tema|lectia|\d+[.)])\s+/i.test(line);
    const isShortTitle =
      line.length >= 5 &&
      line.length <= 80 &&
      !/[.!?]$/.test(line) &&
      index < lines.length - 1 &&
      lines[index + 1]?.length > 80;

    if (isNumberedHeading || isShortTitle) {
      headingIndexes.push(index);
    }
  });

  if (headingIndexes.length >= 2) {
    return headingIndexes.slice(0, 12).map((lineIndex, position, indexes) => {
      const nextIndex = indexes[position + 1] ?? lines.length;
      const title = lines[lineIndex].replace(/^(capitolul|cap\.?|unitatea|tema|lectia|\d+[.)])\s+/i, "").trim();
      const content = lines.slice(lineIndex + 1, nextIndex).join("\n");

      return {
        title: titleCase(title || `Capitolul ${position + 1}`),
        content
      };
    }).filter((chapter) => chapter.content.length >= 80);
  }

  const paragraphs = normalized.split(/\n\s*\n/).map((item) => item.trim()).filter(Boolean);
  const chapterCount = Math.min(6, Math.max(1, Math.ceil(normalized.length / 2400)));
  const bucketSize = Math.ceil(paragraphs.length / chapterCount) || 1;

  return Array.from({ length: chapterCount }, (_, index) => {
    const content = paragraphs.slice(index * bucketSize, (index + 1) * bucketSize).join("\n\n");
    return {
      title: `Capitolul ${index + 1}`,
      content
    };
  }).filter((chapter) => chapter.content.length >= 80);
}

function getFrequentTerms(text, limit = 8) {
  const words = cleanText(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .match(/[a-z][a-z-]{4,}/g) || [];
  const counts = new Map();

  for (const word of words) {
    if (STOP_WORDS.has(word)) continue;
    counts.set(word, (counts.get(word) || 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([word]) => titleCase(word));
}

function buildSummary(sentences) {
  if (!sentences.length) {
    return "Capitolul are continut util de parcurs si repetat.";
  }

  return sentences.slice(0, 2).join(" ");
}

function buildKeyIdeas(sentences) {
  const priority = sentences.filter((sentence) =>
    /\b(este|reprezinta|include|presupune|determina|permite|are rol|se refera)\b/i.test(sentence)
  );

  return [...priority, ...sentences].slice(0, 4);
}

function makeDefinition(term, sentences) {
  const match = sentences.find((sentence) => sentence.toLowerCase().includes(term.toLowerCase()));
  return match || `${term} este un concept important din acest capitol si merita repetat in context.`;
}

function buildDistractors(terms, currentTerm) {
  const candidates = terms.filter((term) => term !== currentTerm).slice(0, 3);
  const fallback = ["O etapa secundara", "Un exemplu izolat", "O exceptie din material"];
  return [...candidates, ...fallback].slice(0, 3);
}

export function buildLearningArtifactsFromText({ title, text, examDate = null, minutesPerDay = 30, objective = "" }) {
  const normalized = cleanText(text);
  const warnings = [];

  if (normalized.length < 900) {
    warnings.push("Textul este scurt, asa ca materialele generate sunt orientative.");
  }

  const chapterBlocks = detectChapterBlocks(normalized);
  if (chapterBlocks.length <= 1) {
    warnings.push("Nu am gasit capitole clare; am impartit materialul automat.");
  }

  let deduplicatedCount = 0;
  const globalConceptKeys = new Set();
  const globalQuestionKeys = new Set();

  const chapters = chapterBlocks.slice(0, 12).map((chapter, chapterIndex) => {
    const sentences = splitSentences(chapter.content);
    const keyTerms = getFrequentTerms(chapter.content, 8);
    const keyIdeas = buildKeyIdeas(sentences);
    const rawConcepts = keyTerms.slice(0, 5).map((term, conceptIndex) => {
      const definition = makeDefinition(term, sentences);
      return {
        position: conceptIndex + 1,
        title: term,
        simpleExplanation: definition,
        example: `Exemplu din capitol: ${definition.slice(0, 180)}`,
        analogy: `${term} functioneaza ca un reper care te ajuta sa legi ideile din capitol.`,
        checkQuestion: `Cum ai explica pe scurt conceptul "${term}"?`
      };
    });
    const concepts = reindexItems(
      rawConcepts.filter((concept) => {
        const key = normalizeDedupeKey(concept.title);
        if (!key) return false;
        if (globalConceptKeys.has(key)) {
          deduplicatedCount += 1;
          return false;
        }
        globalConceptKeys.add(key);
        return true;
      })
    );
    const flashcards = concepts.map((concept, flashcardIndex) => ({
      position: flashcardIndex + 1,
      front: `Ce inseamna ${concept.title}?`,
      back: concept.simpleExplanation,
      hint: chapter.title
    }));
    const questions = reindexItems(
      concepts.slice(0, 5).map((concept, questionIndex) => ({
        position: questionIndex + 1,
        questionText: `Ce descrie cel mai bine conceptul "${concept.title}"?`,
        answers: [
          concept.simpleExplanation,
          ...buildDistractors(keyTerms, concept.title).map((term) => `${term} este conceptul central al raspunsului.`)
        ].slice(0, 4),
        correctIndex: 0,
        explanation: concept.simpleExplanation,
        difficulty: questionIndex < 2 ? "usor" : "mediu"
      })).filter((question) => {
        const key = normalizeDedupeKey(question.questionText);
        if (!key) return false;
        if (globalQuestionKeys.has(key)) {
          deduplicatedCount += 1;
          return false;
        }
        globalQuestionKeys.add(key);
        return true;
      })
    );

    return {
      position: chapterIndex + 1,
      title: chapter.title,
      summary: buildSummary(sentences),
      keyIdeas,
      keyTerms,
      sourceHint: `Sectiune ${chapterIndex + 1}`,
      qualityStatus: keyTerms.length < 3 ? "partial" : "accepted",
      qualityNotes: keyTerms.length < 3 ? "Capitolul are putini termeni detectabili." : "",
      concepts,
      flashcards,
      questions
    };
  });

  const conceptCount = chapters.reduce((total, chapter) => total + chapter.concepts.length, 0);
  const flashcardCount = chapters.reduce((total, chapter) => total + chapter.flashcards.length, 0);
  const questionCount = chapters.reduce((total, chapter) => total + chapter.questions.length, 0);
  const recommendedDays = examDate
    ? Math.max(
        1,
        Math.min(
          30,
          Math.ceil((new Date(examDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
        )
      )
    : Math.max(2, Math.min(7, Math.ceil(chapters.length / 2)));
  const plan = chapters.map((chapter, index) => ({
    day: (index % recommendedDays) + 1,
    title: `Ziua ${(index % recommendedDays) + 1}`,
    activities: [
      `Parcurge ${chapter.title}`,
      `Repeta ${Math.min(chapter.flashcards.length, 10)} flashcards`,
      `Fa un test scurt din capitol`
    ]
  }));

  if (!flashcardCount && !questionCount) {
    warnings.push("Nu am putut construi suficiente activitati din textul primit.");
  }

  if (deduplicatedCount > 0) {
    warnings.push(`Am eliminat ${deduplicatedCount} elemente repetitive din material.`);
  }

  return {
    title: title?.trim() || "Materia mea",
    status: warnings.length ? "ready_with_warnings" : "ready",
    sourceExcerpt: normalized.slice(0, 700),
    estimatedPages: Math.max(1, Math.ceil(normalized.length / 2600)),
    recommendedLevel: normalized.length > 14000 ? "greu" : normalized.length > 4500 ? "mediu" : "usor",
    recommendedDays,
    recommendedMinutesPerDay: minutesPerDay,
    objective,
    warnings,
    chapters,
    stats: {
      chapterCount: chapters.length,
      conceptCount,
      flashcardCount,
      questionCount,
      deduplicatedCount
    },
    plan
  };
}
