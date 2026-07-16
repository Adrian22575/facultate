import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import {
  FEEDBACK_SCREENSHOT_MAX_BYTES,
  FEEDBACK_SCREENSHOT_MAX_LABEL,
  getFeedbackScreenshotType
} from "@/lib/feedback-screenshot";
import { notifyAdminFeedbackSubmitted } from "@/lib/notifications/telegram";
import { assertRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseSetupIncompleteError } from "@/lib/supabase/setup-status";

export const runtime = "nodejs";

const FEEDBACK_SCREENSHOT_BUCKET = "feedback-screenshots";

function invalidScreenshot(message) {
  const error = new Error(message);
  error.code = "INVALID_SCREENSHOT";
  return error;
}

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

function readTextField(formData, fieldName) {
  const value = formData.get(fieldName);
  return typeof value === "string" ? value : "";
}

async function readFeedbackRequest(request) {
  const contentType = request.headers.get("content-type") || "";

  if (!contentType.includes("multipart/form-data")) {
    return { payload: await request.json(), screenshot: null };
  }

  const formData = await request.formData();
  const screenshotValue = formData.get("screenshot");

  return {
    payload: {
      feedbackType: readTextField(formData, "feedbackType"),
      message: readTextField(formData, "message"),
      optionalDetail: readTextField(formData, "optionalDetail"),
      pagePath: readTextField(formData, "pagePath")
    },
    screenshot: screenshotValue instanceof File ? screenshotValue : null
  };
}

function startsWithBytes(bytes, expected) {
  return expected.every((value, index) => bytes[index] === value);
}

function isExpectedImage(bytes, mimeType) {
  if (mimeType === "image/png") {
    return startsWithBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  }

  if (mimeType === "image/jpeg") {
    return startsWithBytes(bytes, [0xff, 0xd8, 0xff]);
  }

  return (
    startsWithBytes(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  );
}

async function prepareScreenshot(file) {
  const type = getFeedbackScreenshotType(file.type);
  if (!type) {
    throw invalidScreenshot("Atașează o imagine PNG, JPG sau WEBP.");
  }

  if (!file.size) {
    throw invalidScreenshot("Captura selectată este goală.");
  }

  if (file.size > FEEDBACK_SCREENSHOT_MAX_BYTES) {
    throw invalidScreenshot(`Captura depășește limita de ${FEEDBACK_SCREENSHOT_MAX_LABEL}.`);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!isExpectedImage(bytes, file.type)) {
    throw invalidScreenshot("Captura nu pare să fie o imagine validă.");
  }

  return {
    bytes,
    mimeType: file.type,
    sizeBytes: file.size,
    extension: type.extension
  };
}

export async function POST(request) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Trebuie sa fii logat." }, { status: 401 });
  }

  let requestData;
  try {
    requestData = await readFeedbackRequest(request);
  } catch {
    return NextResponse.json({ error: "Feedback-ul nu este valid." }, { status: 400 });
  }

  let payload;
  try {
    payload = FeedbackPayloadSchema.parse(requestData.payload);
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.issues[0]?.message || "Feedback-ul nu este valid."
        : "Feedback-ul nu este valid.";

    return NextResponse.json({ error: message }, { status: 400 });
  }

  let uploadedScreenshot = null;
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
    let screenshot = null;

    if (requestData.screenshot) {
      screenshot = await prepareScreenshot(requestData.screenshot);
      const storagePath = `${user.id}/${feedbackId}.${screenshot.extension}`;
      const admin = createAdminClient();
      const { error: uploadError } = await admin.storage
        .from(FEEDBACK_SCREENSHOT_BUCKET)
        .upload(storagePath, screenshot.bytes, {
          contentType: screenshot.mimeType,
          upsert: false,
          cacheControl: "0"
        });

      if (uploadError) {
        throw uploadError;
      }

      uploadedScreenshot = {
        bucket: FEEDBACK_SCREENSHOT_BUCKET,
        path: storagePath
      };
    }

    const feedbackRow = {
      id: feedbackId,
      user_id: user.id,
      user_email: user.email || null,
      user_type: profile?.user_type || null,
      feedback_type: payload.feedbackType,
      message: payload.message,
      optional_detail: payload.optionalDetail || null,
      page_path: payload.pagePath,
      screenshot_bucket: uploadedScreenshot?.bucket || null,
      screenshot_path: uploadedScreenshot?.path || null,
      screenshot_mime_type: screenshot?.mimeType || null,
      screenshot_size_bytes: screenshot?.sizeBytes || null
    };

    const { error } = await supabase.from("feedback_submissions").insert(feedbackRow);
    if (error) {
      throw error;
    }

    notifyAdminFeedbackSubmitted({
      feedback: {
        id: feedbackId,
        feedbackType: payload.feedbackType,
        message: payload.message,
        optionalDetail: payload.optionalDetail || null,
        pagePath: payload.pagePath,
        hasScreenshot: Boolean(uploadedScreenshot)
      },
      user,
      profile
    }).catch((notificationError) => {
      console.error("feedback_notification_failed", notificationError);
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (uploadedScreenshot) {
      await createAdminClient().storage.from(uploadedScreenshot.bucket).remove([uploadedScreenshot.path]).catch(() => {});
    }

    if (error?.code === "RATE_LIMITED") {
      return NextResponse.json(
        { error: error.message },
        {
          status: 429,
          headers: { "Retry-After": String(error.retryAfterSeconds || 3600) }
        }
      );
    }

    if (error?.code === "INVALID_SCREENSHOT") {
      return NextResponse.json({ error: error.message }, { status: 400 });
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
