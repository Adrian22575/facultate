import { NextResponse } from "next/server";

import { isAdminUser } from "@/lib/admin";
import { depublishLearningStudySetFromCommunity } from "@/lib/learning/study-sets";
import { getOptionalUser } from "@/lib/supabase/guards";

export async function POST(request, { params }) {
  const user = await getOptionalUser();

  if (!user || !(await isAdminUser(user))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const resolvedParams = await params;
  const studySetId = String(resolvedParams?.studySetId || "").trim();

  if (!studySetId) {
    return NextResponse.json({ error: "missing_study_set" }, { status: 400 });
  }

  let payload = {};
  try {
    payload = await request.json();
  } catch {
    payload = {};
  }

  try {
    const result = await depublishLearningStudySetFromCommunity({
      studySetId,
      adminUserId: user.id,
      reason: payload.reason || "admin_review"
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error("admin_learning_study_set_depublish_failed", error);
    return NextResponse.json({ error: "depublish_failed" }, { status: 500 });
  }
}
