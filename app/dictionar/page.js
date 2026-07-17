import { DictionaryIndexClient } from "@/components/dictionary-index-client";
import { DictionaryBreadcrumbs, DictionaryShell } from "@/components/dictionary-page";
import { getDictionaryOverview } from "@/lib/dictionary/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dicționar pentru învățare și examene | Nota 5+", description: "Explicații simple pentru termeni despre învățare, memorie, examene, teste grilă, facultate și organizarea studiului.", alternates: { canonical: "/dictionar" }, openGraph: { title: "Dicționar pentru învățare și examene | Nota 5+", description: "Termeni explicați clar pentru elevi și studenți.", url: "/dictionar", type: "website" } };

export default async function DictionaryPage() {
  const overview = await getDictionaryOverview();
  return <DictionaryShell><DictionaryBreadcrumbs /><DictionaryIndexClient {...overview} /></DictionaryShell>;
}
