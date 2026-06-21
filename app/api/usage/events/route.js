import { NextResponse } from "next/server";
import { z } from "zod";

import { assertRateLimit, getRateLimitSubject } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseSetupIncompleteError } from "@/lib/supabase/setup-status";
import { sanitizeUsagePath, sanitizeUsageQuery } from "@/lib/usage-events";

const EVENT_NAME_PATTERN = /^[a-z0-9_.:-]+$/i;
const DEVICE_TYPES = ["desktop", "tablet", "mobile", "unknown"];
const MAX_METADATA_KEYS = 12;

const UsageEventSchema = z.object({
  eventName: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(EVENT_NAME_PATTERN)
    .default("page_view"),
  sessionId: z.string().trim().min(6).max(120).optional().nullable(),
  feature: z.string().trim().min(1).max(80).optional().nullable(),
  routePath: z
    .string()
    .trim()
    .min(1)
    .max(300)
    .refine((value) => value.startsWith("/"), "invalid_route")
    .optional()
    .nullable(),
  routeQuery: z.string().trim().max(500).optional().nullable(),
  referrerPath: z.string().trim().max(300).optional().nullable(),
  deviceType: z.enum(DEVICE_TYPES).default("unknown"),
  viewportWidth: z.number().int().min(0).max(10000).optional().nullable(),
  viewportHeight: z.number().int().min(0).max(10000).optional().nullable(),
  metadata: z.record(z.unknown()).optional().nullable()
});

function truncateString(value, maxLength) {
  if (typeof value !== "string") {
    return value;
  }

  return value.trim().slice(0, maxLength);
}

function sanitizeMetadata(metadata) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(metadata)
      .slice(0, MAX_METADATA_KEYS)
      .map(([key, value]) => {
        const safeKey = truncateString(String(key || ""), 48).replace(/[^\w.-]/g, "_");

        if (!safeKey) {
          return null;
        }

        if (typeof value === "string") {
          return [safeKey, truncateString(value, 180)];
        }

        if (typeof value === "number" && Number.isFinite(value)) {
          return [safeKey, value];
        }

        if (typeof value === "boolean" || value === null) {
          return [safeKey, value];
        }

        return [safeKey, truncateString(JSON.stringify(value || ""), 180)];
      })
      .filter(Boolean)
  );
}

async function getCurrentUserId() {
  try {
    const supabase = await createClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    return user?.id || null;
  } catch {
    return null;
  }
}

export async function POST(request) {
  let payload;

  try {
    payload = UsageEventSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "invalid_usage_event" }, { status: 400 });
  }

  const userId = await getCurrentUserId();
  try {
    await assertRateLimit({
      action: "usage_event",
      subject: getRateLimitSubject(request, userId),
      windowSeconds: 15 * 60,
      maxRequests: 180
    });
  } catch (error) {
    if (error?.code === "RATE_LIMITED") {
      return NextResponse.json({ ok: false, warning: "rate_limited" }, { status: 202 });
    }
    throw error;
  }

  const admin = createAdminClient();
  const { error } = await admin.from("user_usage_events").insert({
    user_id: userId,
    session_id: payload.sessionId || null,
    event_name: payload.eventName,
    feature: payload.feature || null,
    route_path: sanitizeUsagePath(payload.routePath) || null,
    route_query: sanitizeUsageQuery(payload.routeQuery) || null,
    referrer_path: sanitizeUsagePath(payload.referrerPath) || null,
    device_type: payload.deviceType || "unknown",
    viewport_width: payload.viewportWidth || null,
    viewport_height: payload.viewportHeight || null,
    metadata: sanitizeMetadata(payload.metadata)
  });

  if (error) {
    if (isSupabaseSetupIncompleteError(error)) {
      return NextResponse.json({ ok: false, warning: "usage_events_table_missing" }, { status: 202 });
    }

    console.error("usage_event_insert_failed", {
      code: error.code,
      message: error.message
    });

    return NextResponse.json({ error: "usage_event_insert_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
