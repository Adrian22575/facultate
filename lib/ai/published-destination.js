export function buildPublishedQuestionBankHref(bank) {
  if (bank?.exam_type === "licenta") {
    return "/licenta-exam";
  }

  if (bank?.subject_id && bank.subject_id !== "custom") {
    return `/materii/${bank.subject_id}`;
  }

  return "/materii";
}

export function buildPublishedDraftHref(test) {
  if (test?.subject_id && test.subject_id !== "custom") {
    return `/materii/${test.subject_id}`;
  }

  return `/materiale/drafts/${test.id}?published=1`;
}
