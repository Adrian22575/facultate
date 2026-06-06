import { NextResponse } from "next/server";

import {
  abandonLicentaImportSession,
  getLicentaImportSessionSnapshot
} from "@/lib/ai/import-pipeline";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  const resolvedParams = await params;
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const snapshot = await getLicentaImportSessionSnapshot({
      sessionId: resolvedParams.sessionId,
      userId: user.id
    });

    return NextResponse.json(snapshot, {
      headers: {
        "Cache-Control": "no-store, max-age=0"
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nu am putut incarca licenta." },
      { status: 500 }
    );
  }
}

export async function DELETE(_request, { params }) {
  const resolvedParams = await params;
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await abandonLicentaImportSession({
      sessionId: resolvedParams.sessionId,
      userId: user.id
    });

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store, max-age=0"
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nu am putut abandona licenta." },
      { status: 500 }
    );
  }
}
