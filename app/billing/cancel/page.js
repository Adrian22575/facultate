import Link from "next/link";

import { AppHeader } from "@/components/app-header";

export const metadata = {
  title: "Plata anulata | Nota 5+"
};

function getSafeReturnTo(value) {
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.includes("\\") || trimmed.includes("\n")) {
    return "";
  }

  return trimmed.slice(0, 300);
}

export default async function BillingCancelPage({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const returnTo = getSafeReturnTo(resolvedSearchParams?.return_to);
  const targetHref = returnTo || "/cont?section=plans";

  return (
    <main className="app-shell">
      <AppHeader
        action={
          <Link className="btn-back" href={targetHref}>
            {returnTo ? "Inapoi la licenta" : "Inapoi la cont"}
          </Link>
        }
        kicker="Plata anulata"
        title="Plata a fost anulata"
        subtitle="Nu s-a aplicat nicio modificare pe cont."
      />
    </main>
  );
}
