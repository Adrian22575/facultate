import Link from "next/link";

import { AppHeader } from "@/components/app-header";
import { BillingSuccessRedirect } from "@/components/billing-success-redirect";
import { getBillingSnapshot, reconcileCheckoutSession } from "@/lib/billing";
import { hasStripeEnv, resolveStripeMode } from "@/lib/stripe/server";

export const metadata = {
  title: "Plata reusita | Nota 5+"
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

export default async function BillingSuccessPage({ searchParams }) {
  const resolvedSearchParams = await searchParams;
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
      const result = await reconcileCheckoutSession(sessionId, { stripeMode });
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
        title = "Plata este confirmata";
        subtitle = "Asteptam confirmarea finala pentru actualizare.";
        status = "pending";
        detail =
          "Plata este reusita, dar actualizarea mai dureaza putin. Daca esti in local, verifica si listener-ul Stripe.";
      }
    } catch (_error) {
      targetHref = returnTo || "/cont?section=plans";
      title = "Plata este reusita";
      subtitle = "Nu am putut confirma imediat actualizarea contului.";
      status = "warning";
      detail =
        "Daca nu vezi schimbarea imediat, intra in cont peste cateva secunde. In local, verifica daca Stripe CLI a fost pornit.";
    }
  }

  return (
    <main className="app-shell">
      <AppHeader
        action={
          <Link className="btn-back" href={targetHref}>
            Inapoi la cont
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
