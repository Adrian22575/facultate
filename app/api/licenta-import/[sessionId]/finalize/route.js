import { NextResponse } from "next/server";

import { finalizeLicentaImportSession } from "@/lib/ai/import-pipeline";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 300;

function getFinalizeErrorPayload(error) {
  const rawMessage =
    error instanceof Error
      ? error.message
      : typeof error?.message === "string"
        ? error.message
        : typeof error?.details === "string"
          ? error.details
          : "";
  const normalized = rawMessage.toLowerCase();

  if (normalized.includes("incarcari disponibile")) {
    return {
      code: "credits_required",
      message: rawMessage || "Nu ai incarcari disponibile pentru finalizarea licentei.",
      status: 402
    };
  }

  if (normalized.includes("seturi salvate")) {
    return {
      code: "no_saved_sets",
      message: rawMessage,
      status: 400
    };
  }

  if (
    normalized.includes("seturile ramase") ||
    normalized.includes("finalizeaza, corecteaza") ||
    normalized.includes("revizuieste") ||
    normalized.includes("raspunsuri lipsa") ||
    normalized.includes("intrebari marcate")
  ) {
    if (normalized.includes("seturile ramase") || normalized.includes("finalizeaza, corecteaza")) {
      return {
        code: "sets_not_saved",
        message: "Exista seturi corectate sau deschise care nu sunt salvate in licenta. Salveaza fiecare set in licenta, apoi finalizeaza.",
        status: 409
      };
    }

    return {
      code: "sets_need_review",
      message: rawMessage,
      status: 409
    };
  }

  console.error("licenta_finalize_failed", error);
  const isUnhelpfulProviderMessage =
    !rawMessage ||
    normalized === "bad request" ||
    normalized.includes("bad request") ||
    rawMessage === "Failed to fetch";

  return {
    code: "finalize_failed",
    message: isUnhelpfulProviderMessage
      ? "Finalizarea s-a oprit la pregatirea testului final. Verifica seturile salvate si incearca din nou."
      : rawMessage,
    status: 500
  };
}

export async function POST(_request, { params }) {
  const resolvedParams = await params;
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const snapshot = await finalizeLicentaImportSession({
      sessionId: resolvedParams.sessionId,
      userId: user.id
    });

    return NextResponse.json(snapshot, {
      headers: {
        "Cache-Control": "no-store, max-age=0"
      }
    });
  } catch (error) {
    const payload = getFinalizeErrorPayload(error);
    return NextResponse.json(
      { error: payload.message, code: payload.code },
      { status: payload.status }
    );
  }
}
