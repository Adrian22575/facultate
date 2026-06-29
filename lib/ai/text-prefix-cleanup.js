const BARE_QUESTION_NUMBER_PREFIX_PATTERN = /^\s*\d{1,4}\s*[\.:]\s*/;
const BARE_QUESTION_DASH_PREFIX_PATTERN = /^\s*\d{1,4}\s+-\s+/;
const EXPLICIT_QUESTION_PREFIX_PATTERN =
  /^\s*(?:(?:(?:i|\u00ee)ntrebarea|question)\s*|(?:nr\.?\s*))\d{1,4}\s*[\).:\-]\s*/i;

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeLabelToken(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

function expectedOptionLabel(index = 0) {
  return String.fromCharCode(97 + Math.max(0, Number(index) || 0));
}

export function stripQuestionNumberPrefix(value) {
  let text = String(value || "").trim();

  for (let index = 0; index < 2; index += 1) {
    const next = text
      .replace(EXPLICIT_QUESTION_PREFIX_PATTERN, "")
      .replace(BARE_QUESTION_NUMBER_PREFIX_PATTERN, "")
      .replace(BARE_QUESTION_DASH_PREFIX_PATTERN, "")
      .trim();
    if (next === text) {
      break;
    }
    text = next;
  }

  return text;
}

export function stripAnswerLabelPrefix(value, label = "", index = 0) {
  let text = String(value || "").trim();
  const labels = [
    normalizeLabelToken(label),
    expectedOptionLabel(index)
  ].filter(Boolean);
  const uniqueLabels = [...new Set(labels)];

  for (let pass = 0; pass < 3; pass += 1) {
    let changed = false;

    for (const candidate of uniqueLabels) {
      const prefixPattern = new RegExp(`^\\s*${escapeRegExp(candidate)}\\s*[\\).:\\-]\\s*`, "i");
      const next = text.replace(prefixPattern, "").trim();
      if (next !== text) {
        text = next;
        changed = true;
      }
    }

    if (!changed) {
      break;
    }
  }

  return text;
}
