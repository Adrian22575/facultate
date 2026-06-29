import assert from "node:assert/strict";

import { areLikelySameImportQuestionForDedupe } from "@/lib/ai/import-pipeline";
import { areLikelySameQuestionBankItemForDedupe } from "@/lib/ai/question-bank-pipeline";

const baseQuestion =
  "Care dintre urmatoarele afirmatii despre controlul financiar preventiv este corecta in procedura interna?";
const similarQuestion =
  "Care dintre urmatoarele afirmatii privind controlul financiar preventiv este corecta in procedura interna?";

const answers = [
  "Se aplica inainte de angajarea operatiunii.",
  "Se aplica numai dupa plata.",
  "Este optional pentru toate documentele.",
  "Se aplica doar la finalul auditului."
];

const changedAnswers = [
  "Se aplica inainte de angajarea operatiunii.",
  "Se aplica numai dupa plata.",
  "Este optional pentru toate documentele.",
  "Se aplica doar pentru documentele arhivate."
];

assert.equal(
  areLikelySameQuestionBankItemForDedupe(
    { question_text: baseQuestion, answers, correct_index: 0 },
    { question_text: similarQuestion, answers: [...answers].reverse(), correct_index: 3 }
  ),
  true,
  "question-bank dedupe keeps real duplicates even when answer order differs"
);

assert.equal(
  areLikelySameQuestionBankItemForDedupe(
    { question_text: baseQuestion, answers, correct_index: 0 },
    { question_text: similarQuestion, answers: changedAnswers, correct_index: 0 }
  ),
  false,
  "question-bank dedupe preserves similar questions with at least one different answer"
);

assert.equal(
  areLikelySameQuestionBankItemForDedupe(
    { question_text: baseQuestion, answers, correct_index: 0 },
    { question_text: similarQuestion, answers, correct_index: 1 }
  ),
  false,
  "question-bank dedupe preserves conflicting correct answers"
);

const importOptions = answers.map((text, index) => ({ label: String.fromCharCode(97 + index), text, is_correct: index === 0 }));
const importOptionsMissingAnswer = answers.map((text, index) => ({
  label: String.fromCharCode(97 + index),
  text,
  is_correct: false
}));
const importChangedOptions = changedAnswers.map((text, index) => ({
  label: String.fromCharCode(97 + index),
  text,
  is_correct: index === 0
}));
const importConflictingOptions = answers.map((text, index) => ({
  label: String.fromCharCode(97 + index),
  text,
  is_correct: index === 1
}));

assert.equal(
  areLikelySameImportQuestionForDedupe(
    { questionText: baseQuestion, options: importOptionsMissingAnswer },
    { questionText: similarQuestion, options: importOptions }
  ),
  true,
  "import dedupe can replace the same question when one copy has the missing answer"
);

assert.equal(
  areLikelySameImportQuestionForDedupe(
    { questionText: baseQuestion, options: importOptions },
    { questionText: similarQuestion, options: importChangedOptions }
  ),
  false,
  "import dedupe preserves similar questions with a different answer option"
);

assert.equal(
  areLikelySameImportQuestionForDedupe(
    { questionText: baseQuestion, options: importOptions },
    { questionText: similarQuestion, options: importConflictingOptions }
  ),
  false,
  "import dedupe preserves conflicting correct answers"
);

console.log("dedup_regression_check_ok");
