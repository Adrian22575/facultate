import { NextResponse } from "next/server";

import {
  applyCheckoutSession,
  beginStripeEventProcessing,
  completeStripeEventProcessing,
  failStripeEventProcessing
} from "@/lib/billing";
import { assertRateLimit } from "@/lib/rate-limit";
import { getStripe, getStripeWebhookSecret, hasStripeWebhookSecret } from "@/lib/stripe/server";

export async function POST(request) {
  if (!hasStripeWebhookSecret()) {
    return NextResponse.json(
      { error: "Stripe webhook nu este configurat pe server." },
      { status: 503 }
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Lipsește Stripe-Signature." }, { status: 400 });
  }

  const payload = await request.text();
  const stripe = getStripe();
  const forwardedFor = request.headers.get("x-forwarded-for");
  const webhookSubject = forwardedFor || "stripe_webhook";

  try {
    await assertRateLimit({
      action: "stripe_webhook",
      subject: webhookSubject,
      windowSeconds: 60,
      maxRequests: 120
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Webhook-ul Stripe depășește limita temporară."
      },
      { status: 429 }
    );
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      payload,
      signature,
      getStripeWebhookSecret()
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Semnătura webhook-ului Stripe nu a putut fi verificată."
      },
      { status: 400 }
    );
  }

  const shouldProcess = await beginStripeEventProcessing(event.id, event.type);
  if (!shouldProcess) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      if (session.payment_status === "paid") {
        await applyCheckoutSession(session);
      }
    }

    await completeStripeEventProcessing(event.id);
  } catch (error) {
    await failStripeEventProcessing(
      event.id,
      error instanceof Error ? error.message : "fulfillment_failed"
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Webhook fulfillment failed."
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}
