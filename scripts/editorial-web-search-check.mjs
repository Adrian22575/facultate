import fs from "node:fs";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

function envFromFile(path) {
  if (!fs.existsSync(path)) return {};
  return Object.fromEntries(fs.readFileSync(path, "utf8").split(/\r?\n/).filter((line) => line.includes("=") && !line.trim().startsWith("#")).map((line) => { const index = line.indexOf("="); return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "")]; }));
}

const env = { ...envFromFile(".env.local"), ...process.env };
const model = env.OPENAI_EDITORIAL_MODEL || "gpt-5.6";
const apiKey = env.OPENAI_API_KEY;
if (!apiKey) throw new Error("OPENAI_API_KEY_missing");
const schema = z.object({ sources: z.array(z.object({ title: z.string().min(3), url: z.string().regex(/^https?:\/\//) })).min(1).max(3) });
const client = new OpenAI({ apiKey });
const response = await client.responses.parse({ model, reasoning: { effort: "high" }, tools: [{ type: "web_search" }], input: "Caută o singură sursă oficială, publicată recent, despre educație în Europa. Returnează exclusiv structura cerută.", text: { format: zodTextFormat(schema, "editorial_web_search_check") } });
if (!response.output_parsed?.sources?.length) throw new Error("web_search_structured_output_missing");
console.log(`Editorial web search: ok (${model}, ${response.output_parsed.sources.length} surse)`);
