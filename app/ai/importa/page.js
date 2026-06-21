import { ImportWorkspacePage } from "@/components/import-workspace-page";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Importa intrebari existente | Nota 5+",
  description: "Incarca si verifica intrebari grila pentru materia potrivita."
};

export default function ExistingQuestionsImportPage({ searchParams }) {
  return <ImportWorkspacePage mode="test" searchParams={searchParams} />;
}
