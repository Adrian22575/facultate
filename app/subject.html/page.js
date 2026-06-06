import { redirect } from "next/navigation";

export default async function LegacySubjectPage({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const subjectId = resolvedSearchParams?.subject;

  if (typeof subjectId === "string" && subjectId.length) {
    redirect(`/materii/${encodeURIComponent(subjectId)}`);
  }

  redirect("/materii");
}
