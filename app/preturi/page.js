import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function PricingPage({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const section = resolvedSearchParams?.view === "ai" ? "credits" : "plans";
  redirect(`/cont?section=${section}`);
}
