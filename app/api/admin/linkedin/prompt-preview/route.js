import { NextResponse } from "next/server";

import { isAdminUser } from "@/lib/admin";
import { getLinkedInGenerationPreviewForTemplate } from "@/lib/linkedin/server";
import { normalizeLinkedInModel } from "@/lib/linkedin/models";
import { linkedinGenerationOptionsSchema } from "@/lib/linkedin/requests";
import { createClient } from "@/lib/supabase/server";

export async function GET(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdminUser(user))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const parsed = linkedinGenerationOptionsSchema.safeParse({
    templateKey: params.get("template") || undefined,
    objectiveKey: params.get("objective") || undefined,
    voiceKey: params.get("voice") || undefined,
    audienceKey: params.get("audience") || undefined,
    customAudience: params.get("customAudience") || undefined,
    ctaKey: params.get("cta") || undefined,
    narrativeKey: params.get("narrative") || undefined,
    lengthKey: params.get("length") || undefined,
    linkPlacementKey: params.get("linkPlacement") || undefined
  });
  if (!parsed.success) return NextResponse.json({ error: "invalid_generation_options" }, { status: 400 });
  const preview = getLinkedInGenerationPreviewForTemplate(normalizeLinkedInModel(params.get("model")), parsed.data);
  return NextResponse.json({ preview });
}
