import { NextResponse } from "next/server";

import { isAdminUser } from "@/lib/admin";
import { getLinkedInGenerationPreviewForTemplate } from "@/lib/linkedin/server";
import { normalizeLinkedInModel } from "@/lib/linkedin/models";
import { getLinkedInPostObjective, getLinkedInPostTemplate, getLinkedInPostVoice } from "@/lib/linkedin/templates";
import { createClient } from "@/lib/supabase/server";

export async function GET(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdminUser(user))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const template = getLinkedInPostTemplate(params.get("template"));
  const objective = getLinkedInPostObjective(params.get("objective"));
  const voice = getLinkedInPostVoice(params.get("voice"));
  const preview = getLinkedInGenerationPreviewForTemplate(normalizeLinkedInModel(params.get("model")), template.key, objective.key, voice.key);
  return NextResponse.json({ preview });
}
