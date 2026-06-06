import { redirect } from "next/navigation";

export default async function LegacyInteractivePage({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const subjectId = resolvedSearchParams?.subject;

  if (typeof subjectId === "string" && subjectId.length) {
    redirect(`/materii/${encodeURIComponent(subjectId)}/interactiv`);
  }

  redirect("/materii");
}
