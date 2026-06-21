export function hashLicentaQuestionText(value) {
  let hash = 0;
  const text = String(value || "");

  for (let index = 0; index < text.length; index += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash).toString(36);
}

export function buildLicentaQuestionKey(question, index) {
  const subjectId = question.subjectId || "licenta";

  if (question.id !== undefined && question.id !== null && question.id !== "") {
    return `${subjectId}:${question.id}`;
  }

  return `${subjectId}:text-${hashLicentaQuestionText(question.text || index)}`;
}
