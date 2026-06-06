import { redirect } from "next/navigation";

export default async function LegacyStudyPage({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const subjectId = resolvedSearchParams?.subject;

  if (typeof subjectId === "string" && subjectId.length) {
    redirect(`/materii/${encodeURIComponent(subjectId)}/studiu`);
  }

  redirect("/materii");
}
