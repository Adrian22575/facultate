import "server-only";

import { zodTextFormat } from "openai/helpers/zod";

import { GeneratedQuizSchema } from "@/lib/ai/schema";
import { runLoggedResponseParse } from "@/lib/openai/logging";

const AI_MODEL = "gpt-4o-mini";

export async function generateQuizFromText({ sourceText, requestedTitle }) {
  const prompt = [
    "Genereaza un test de verificare pe baza materialului primit.",
    "Limba raspunsului: romana.",
    "Creeaza exact 10 intrebari grila.",
    "Fiecare intrebare trebuie sa aiba exact 4 variante.",
    "Foloseste doar informatii sustinute de material.",
    "Nu inventa fapte care nu apar in text.",
    "Explicatia trebuie sa fie scurta si utila pentru recapitulare.",
    requestedTitle
      ? `Titlul sugerat de utilizator este: ${requestedTitle}. Daca este bun, pastreaza-l.`
      : "Propune un titlu scurt si clar pentru test."
  ].join(" ");

  const response = await runLoggedResponseParse({
    requestScope: "generate_quiz",
    metadata: {
      requestedTitle: requestedTitle || null
    },
    request: {
    model: AI_MODEL,
    input: [
      {
        role: "system",
        content: prompt
      },
      {
        role: "user",
        content: `Material sursa:\n\n${sourceText}`
      }
    ],
    text: {
      format: zodTextFormat(GeneratedQuizSchema, "generated_quiz")
    }
    }
  });

  if (!response.output_parsed) {
    throw new Error("Modelul nu a returnat un test valid.");
  }

  return response.output_parsed;
}
