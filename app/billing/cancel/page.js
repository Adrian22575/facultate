import { AppHeader } from "@/components/app-header";
import { ActionLink } from "@/components/ui/action";
import { getPostLoginNextPath } from "@/lib/auth/password-auth";

export const metadata = {
  title: "Plata anulata | Nota 5+"
};

function getSafeReturnTo(value) {
  const safePath = getPostLoginNextPath(value);
  return safePath === "/" && value !== "/" ? "" : safePath.slice(0, 300);
}

export default async function BillingCancelPage({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const returnTo = getSafeReturnTo(resolvedSearchParams?.return_to);
  const targetHref = returnTo || "/cont?section=plans";

  return (
    <main className="app-shell">
      <AppHeader
        action={
          <ActionLink variant="secondary" href={targetHref}>
            {returnTo ? "Inapoi unde ai ramas" : "Inapoi la cont"}
          </ActionLink>
        }
        kicker="Plata anulata"
        title="Plata a fost anulata"
        subtitle="Nu s-a aplicat nicio modificare pe cont."
      />
    </main>
  );
}
