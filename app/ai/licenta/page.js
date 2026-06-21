import { ImportWorkspacePage } from "@/components/import-workspace-page";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Pregateste licenta | Nota 5+",
  description: "Adauga si verifica seturile pentru simularea generala de licenta."
};

export default function LicentaPreparationPage({ searchParams }) {
  return <ImportWorkspacePage mode="licenta" searchParams={searchParams} />;
}
