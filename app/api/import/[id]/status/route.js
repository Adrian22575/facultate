import { NextResponse } from "next/server";

import { getImportStatus } from "@/lib/ai/import-pipeline";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  const resolvedParams = await params;
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const status = await getImportStatus({
      importJobId: resolvedParams.id,
      userId: user.id
    });

    return NextResponse.json(status, {
      headers: {
        "Cache-Control": "no-store, max-age=0"
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nu am putut incarca statusul." },
      { status: 500 }
    );
  }
}
