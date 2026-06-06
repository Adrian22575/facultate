import { NextResponse } from "next/server";

import { ensureStripeCustomer } from "@/lib/billing";
import { DEMO_USER_ID } from "@/lib/demo-user";
import { assertRateLimit } from "@/lib/rate-limit";
import { getBaseUrl } from "@/lib/site";
import { getBillingPlan } from "@/lib/stripe/plans";
import { getStripe, hasStripeEnv } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseSetupErrorMessage } from "@/lib/supabase/setup-status";

function getSectionForPlanFamily(family) {
  return family === "ai_credits" ? "credits" : "plans";
}

function buildContUrl(request, section, errorMessage) {
  const url = new URL("/cont", request.url);
  url.searchParams.set("section", section);
  if (errorMessage) {
    url.searchParams.set("error", encodeURIComponent(errorMessage));
  }
  return url;
}

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

export async function POST(request) {
  if (!hasStripeEnv()) {
    return NextResponse.json({ error: "Plata nu este configurata pe server." }, { status: 503 });
  }

  const supabaseAuth = await createClient();
  const {
    data: { user }
  } = await supabaseAuth.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/auth/login?next=/cont%3Fsection%3Dplans", request.url), {
      status: 303
    });
  }

  const formData = await request.formData();
  const planCode = formData.get("planCode");
  const returnTo = getSafeReturnTo(formData.get("returnTo"));

  if (typeof planCode !== "string") {
    return NextResponse.json({ error: "Plan invalid." }, { status: 400 });
  }

  const plan = getBillingPlan(planCode);
  if (!plan) {
    return NextResponse.json({ error: "Plan necunoscut." }, { status: 400 });
  }

  const targetSection = getSectionForPlanFamily(plan.family);

  if (user.id === DEMO_USER_ID) {
    return NextResponse.redirect(
      buildContUrl(
        request,
        targetSection,
        "Checkout-ul real este dezactivat in modul demo. Intra cu Google pentru plata reala."
      ),
      { status: 303 }
    );
  }

  try {
    await assertRateLimit({
      action: "stripe_checkout",
      subject: user.id,
      windowSeconds: 10 * 60,
      maxRequests: 10
    });
  } catch (error) {
    return NextResponse.redirect(
      buildContUrl(
        request,
        targetSection,
        error instanceof Error ? error.message : "Checkout-ul nu poate fi pornit momentan."
      ),
      { status: 303 }
    );
  }

  let session;

  try {
    const supabase = createAdminClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", user.id)
      .maybeSingle();

    const customerId = await ensureStripeCustomer({
      userId: user.id,
      email: user.email || profile?.email || null,
      fullName: profile?.full_name || null
    });

    const stripe = getStripe();
    const baseUrl = getBaseUrl(request);

    session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: customerId,
      client_reference_id: user.id,
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: plan.currency,
            product_data: {
              name: plan.name,
              description: plan.description
            },
            unit_amount: plan.amount
          },
          quantity: 1
        }
      ],
      metadata: {
        user_id: user.id,
        plan_code: plan.code,
        family: plan.family
      },
      success_url: `${baseUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}${
        returnTo ? `&return_to=${encodeURIComponent(returnTo)}` : ""
      }`,
      cancel_url: `${baseUrl}/billing/cancel${returnTo ? `?return_to=${encodeURIComponent(returnTo)}` : ""}`
    });
  } catch (error) {
    return NextResponse.redirect(
      buildContUrl(
        request,
        targetSection,
        getSupabaseSetupErrorMessage(error) || "Checkout-ul nu poate fi pornit momentan."
      ),
      { status: 303 }
    );
  }

  if (!session.url) {
    return NextResponse.json({ error: "Checkout-ul nu a returnat un URL valid." }, { status: 500 });
  }

  return NextResponse.redirect(session.url, { status: 303 });
}
