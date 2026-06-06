export function shuffleArray(items) {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
}

export function normalizeQuestions(raw) {
  const questions = Array.isArray(raw) ? raw : raw?.questions || [];

  return questions
    .map((question, index) => ({
      id: question.id ?? index + 1,
      text: question.text ?? question.q ?? "",
      answers: question.answers ?? question.options ?? [],
      correctIndex: question.correctIndex ?? question.correct,
      explanation: question.explanation ?? question.explicatie ?? ""
    }))
    .filter(
      (question) =>
        question.text &&
        Array.isArray(question.answers) &&
        question.answers.length > 0 &&
        Number.isInteger(question.correctIndex)
    );
}

export function normalizeSearchText(text) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ăâîșț\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function scoreQuestionMatch(normalizedQuery, questionText) {
  const normalizedQuestion = normalizeSearchText(questionText);
  if (!normalizedQuery || !normalizedQuestion) return 0;
  if (normalizedQuestion.includes(normalizedQuery)) return 100;

  const queryTokens = normalizedQuery.split(" ").filter((token) => token.length >= 3);
  if (!queryTokens.length) return 0;

  const questionTokens = new Set(
    normalizedQuestion.split(" ").filter((token) => token.length >= 3)
  );

  const matchedTokens = queryTokens.filter((token) => questionTokens.has(token)).length;
  const tokenScore = (matchedTokens / queryTokens.length) * 88;
  const lengthBonus = Math.min(12, normalizedQuery.length / 12);

  return Math.round(tokenScore + lengthBonus);
}

export function truncateText(text, maxLength) {
  if (text.length <= maxLength) return text;
  return `${text.substring(0, maxLength).trim()}...`;
}

export function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
