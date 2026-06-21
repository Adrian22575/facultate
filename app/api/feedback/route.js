import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { notifyAdminFeedbackSubmitted } from "@/lib/notifications/telegram";
import { assertRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseSetupIncompleteError } from "@/lib/supabase/setup-status";

const FeedbackPayloadSchema = z.object({
  feedbackType: z.enum(["problem", "feature", "idea"]),
  message: z.string().trim().min(10, "Scrie cateva detalii utile.").max(3000),
  optionalDetail: z.string().trim().max(500).optional().or(z.literal("")),
  pagePath: z
    .string()
    .trim()
    .min(1)
    .max(300)
    .refine((value) => value.startsWith("/"), "Pagina trimisa nu este valida.")
});

export async function POST(request) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Trebuie sa fii logat." }, { status: 401 });
  }

  let payload;
  try {
    payload = FeedbackPayloadSchema.parse(await request.json());
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.issues[0]?.message || "Feedback-ul nu este valid."
        : "Feedback-ul nu este valid.";

    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    await assertRateLimit({
      action: "feedback_submit",
      subject: user.id,
      windowSeconds: 60 * 60,
      maxRequests: 5
    });

    const { data: profile } = await supabase
      .from("profiles")
      .select("user_type")
      .eq("id", user.id)
      .maybeSingle();

    const feedbackId = randomUUID();
    const feedbackRow = {
      id: feedbackId,
      user_id: user.id,
      user_email: user.email || null,
      user_type: profile?.user_type || null,
      feedback_type: payload.feedbackType,
      message: payload.message,
      optional_detail: payload.optionalDetail || null,
      page_path: payload.pagePath
    };

    const { error } = await supabase.from("feedback_submissions").insert(feedbackRow);

    if (error) {
      throw error;
    }

    await notifyAdminFeedbackSubmitted({
      feedback: {
        id: feedbackId,
        feedbackType: payload.feedbackType,
        message: payload.message,
        optionalDetail: payload.optionalDetail || null,
        pagePath: payload.pagePath
      },
      user,
      profile
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error?.code === "RATE_LIMITED") {
      return NextResponse.json(
        { error: error.message },
        {
          status: 429,
          headers: { "Retry-After": String(error.retryAfterSeconds || 3600) }
        }
      );
    }

    if (isSupabaseSetupIncompleteError(error)) {
      return NextResponse.json(
        {
          error: "Feedback-ul nu este activ inca. Ruleaza migrarea `0010_feedback_submissions.sql`."
        },
        { status: 503 }
      );
    }

    console.error("feedback_submit_failed", error);
    return NextResponse.json(
      { error: "Nu am putut trimite feedback-ul acum. Incearca din nou." },
      { status: 500 }
    );
  }
}
