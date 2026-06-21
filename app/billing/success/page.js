import Link from "next/link";
import { redirect } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { BillingSuccessRedirect } from "@/components/billing-success-redirect";
import { getPostLoginNextPath } from "@/lib/auth/password-auth";
import { getBillingSnapshot, reconcileCheckoutSession } from "@/lib/billing";
import { hasStripeEnv, resolveStripeMode } from "@/lib/stripe/server";
import { getOptionalUser } from "@/lib/supabase/guards";

export const metadata = {
  title: "Plata reusita | Nota 5+"
};

function getSafeReturnTo(value) {
  const safePath = getPostLoginNextPath(value);
  return safePath === "/" && value !== "/" ? "" : safePath.slice(0, 300);
}

function getCurrentSuccessPath(searchParams) {
  const params = new URLSearchParams();
  for (const key of ["session_id", "stripe_mode", "return_to"]) {
    const value = searchParams?.[key];
    if (typeof value === "string" && value) {
      params.set(key, value);
    }
  }
  const query = params.toString();
  return query ? `/billing/success?${query}` : "/billing/success";
}

export default async function BillingSuccessPage({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const user = await getOptionalUser();
  if (!user) {
    redirect(`/auth/login?next=${encodeURIComponent(getCurrentSuccessPath(resolvedSearchParams))}`);
  }
  const returnTo = getSafeReturnTo(resolvedSearchParams?.return_to);
  let targetHref = returnTo || "/cont?section=plans";
  let title = "Plata a fost inregistrata";
  let subtitle = "In cateva momente vei vedea actualizarea in cont.";
  let status = "pending";
  let detail =
    "Te trimitem automat in cateva secunde. Daca vrei, poti merge acum direct mai jos.";

  const sessionId = resolvedSearchParams?.session_id;
  const stripeMode = resolveStripeMode(resolvedSearchParams?.stripe_mode);

  if (typeof sessionId === "string" && sessionId && hasStripeEnv(stripeMode)) {
    try {
      const result = await reconcileCheckoutSession(sessionId, {
        stripeMode,
        expectedUserId: user.id
      });
      targetHref = returnTo || `/cont?section=${result.section}&sync=${result.status}`;

      if (result.status === "applied") {
        title = "Plata a fost aplicata";
        subtitle = "Actualizarea a fost trimisa deja catre contul tau.";
        status = "applied";
        detail = returnTo
          ? "Totul este in regula. Te trimitem inapoi la locul de unde ai ramas."
          : "Totul este in regula. Te trimitem direct in sectiunea potrivita din cont.";
      } else if (result.status === "already_applied") {
        const billingSnapshot = await getBillingSnapshot(result.session.metadata.user_id);

        title = "Plata este confirmata";
        subtitle = "Contul tau este deja actualizat.";
        status = billingSnapshot.activePremium || billingSnapshot.aiCredits > 0 ? "applied" : "confirmed";
        detail =
          status === "applied"
            ? "Planul sau incarcarea este deja in cont. Te trimitem imediat mai departe."
            : "Plata este reusita, dar actualizarea poate mai dura putin daca webhook-ul este in curs.";
      } else {
        title = "Plata este in curs";
        subtitle = "Asteptam confirmarea finala a platii.";
        status = "pending";
        detail =
          "Nu repeta plata. Actualizarea se finalizeaza automat dupa confirmare.";
      }
    } catch (error) {
      targetHref = returnTo || "/cont?section=plans";
      const sessionMismatch = error instanceof Error && error.message === "CHECKOUT_SESSION_USER_MISMATCH";
      title = sessionMismatch ? "Sesiunea nu poate fi verificata" : "Plata este reusita";
      subtitle = sessionMismatch
        ? "Linkul de confirmare nu apartine contului conectat."
        : "Nu am putut confirma imediat actualizarea contului.";
      status = sessionMismatch ? "invalid" : "warning";
      detail = sessionMismatch
        ? "Intra in contul folosit la plata sau revino la pagina de planuri."
        : "Daca nu vezi schimbarea imediat, intra din nou in cont peste cateva secunde. Plata nu trebuie repetata.";
    }
  } else {
    title = "Link de confirmare incomplet";
    subtitle = "Nu am primit identificatorul platii.";
    status = "invalid";
    detail = "Revino in cont pentru a verifica planul si platile disponibile.";
  }

  const backLabel = returnTo ? "Inapoi unde ai ramas" : "Inapoi la cont";

  return (
    <main className="app-shell">
      <AppHeader
        action={
          <Link className="btn-back" href={targetHref}>
            {backLabel}
          </Link>
        }
        title={title}
        subtitle={subtitle}
      />

      <section className="surface">
        <BillingSuccessRedirect href={targetHref} status={status} detail={detail} />
      </section>
    </main>
  );
}
