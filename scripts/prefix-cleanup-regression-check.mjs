import assert from "node:assert/strict";

import {
  stripAnswerLabelPrefix,
  stripQuestionNumberPrefix
} from "@/lib/ai/text-prefix-cleanup";

assert.equal(
  stripQuestionNumberPrefix("1. Care este rolul controlului financiar?"),
  "Care este rolul controlului financiar?",
  "strips numeric question prefix"
);

assert.equal(
  stripQuestionNumberPrefix("Intrebarea 12: Care este documentul justificativ?"),
  "Care este documentul justificativ?",
  "strips explicit question number prefix"
);

assert.equal(
  stripQuestionNumberPrefix("\u00centrebarea 7: Care este varianta corecta?"),
  "Care este varianta corecta?",
  "strips Romanian question prefix with diacritics"
);

assert.equal(
  stripQuestionNumberPrefix("2024 este anul de referinta pentru raportare."),
  "2024 este anul de referinta pentru raportare.",
  "keeps meaningful leading numbers without question punctuation"
);

assert.equal(
  stripQuestionNumberPrefix("1) stabilirea scopurilor studiului;"),
  "1) stabilirea scopurilor studiului;",
  "keeps numbered list items inside a question stem"
);

const managementQuestion = [
  "25. Intre etapele elaborarii unui studiu complex de management comparat se numara:",
  "1) stabilirea scopurilor studiului;",
  "2) traducerea materialelor implicate;",
  "3) masurarea si instrumentalizarea fenomenelor manageriale;",
  "4) urmarirea atingerii obiectivelor;",
  "5) implementarea rezultatelor studiului;",
  "6) generalizarea."
].join("\n");

assert.equal(
  stripQuestionNumberPrefix(managementQuestion),
  [
    "Intre etapele elaborarii unui studiu complex de management comparat se numara:",
    "1) stabilirea scopurilor studiului;",
    "2) traducerea materialelor implicate;",
    "3) masurarea si instrumentalizarea fenomenelor manageriale;",
    "4) urmarirea atingerii obiectivelor;",
    "5) implementarea rezultatelor studiului;",
    "6) generalizarea."
  ].join("\n"),
  "strips only the outer question number and preserves the internal numbered list"
);

assert.equal(
  stripAnswerLabelPrefix("a) a) raspuns 1", "a", 0),
  "raspuns 1",
  "strips repeated answer label prefix"
);

assert.equal(
  stripAnswerLabelPrefix("B. Raspuns 2", "b", 1),
  "Raspuns 2",
  "strips uppercase answer label prefix"
);

assert.equal(
  stripAnswerLabelPrefix("Audit intern si control", "a", 0),
  "Audit intern si control",
  "keeps answer text that starts with the same letter but has no label punctuation"
);

console.log("prefix_cleanup_regression_check_ok");
