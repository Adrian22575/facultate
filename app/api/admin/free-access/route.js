import { NextResponse } from "next/server";

import { isAdminUser } from "@/lib/admin";
import {
  applyAllowlistGrantsForExistingUsers,
  ensurePremiumGrantFromAllowlist,
  normalizeEmail,
  parseEmailList
} from "@/lib/free-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function requireApiAdmin() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user || !(await isAdminUser(user))) {
    return null;
  }

  return user;
}

export async function POST(request) {
  const adminUser = await requireApiAdmin();
  if (!adminUser) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const input = body?.emails;
  const notes = typeof body?.notes === "string" && body.notes.trim() ? body.notes.trim() : null;
  const { valid, invalid } = parseEmailList(input);

  if (!valid.length) {
    return NextResponse.json(
      { error: "Nu ai introdus emailuri valide.", invalid, inserted: 0, total: 0 },
      { status: 400 }
    );
  }

  const payload = valid.map((email) => ({
    email,
    grant_kind: "premium",
    is_active: true,
    notes,
    added_by: adminUser.id
  }));

  const admin = createAdminClient();
  const { error } = await admin.from("free_access_allowlist").upsert(payload, {
    onConflict: "email",
    ignoreDuplicates: false
  });

  if (error) {
    return NextResponse.json({ error: "Nu am putut salva lista de acces gratuit." }, { status: 500 });
  }

  let grantResult = { matchedUsers: 0, applied: 0 };
  let warning = "";
  try {
    grantResult = await applyAllowlistGrantsForExistingUsers(valid);
  } catch (grantError) {
    console.error("[admin/free-access] Existing-user grant failed", grantError);
    warning = "Lista a fost salvata, dar accesul nu a putut fi aplicat imediat utilizatorilor existenti.";
  }

  return NextResponse.json({
    inserted: valid.length,
    total: valid.length + invalid.length,
    invalid,
    matchedUsers: grantResult.matchedUsers,
    grantsApplied: grantResult.applied,
    warning
  });
}

export async function PATCH(request) {
  const adminUser = await requireApiAdmin();
  if (!adminUser) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const id = typeof body?.id === "string" ? body.id : "";
  const isActive = typeof body?.isActive === "boolean" ? body.isActive : null;
  const email = typeof body?.email === "string" ? normalizeEmail(body.email) : "";

  if (!id || isActive === null || !email) {
    return NextResponse.json({ error: "Payload invalid." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: updatedEntry, error } = await admin
    .from("free_access_allowlist")
    .update({
      is_active: isActive,
      added_by: adminUser.id
    })
    .eq("id", id)
    .eq("email", email)
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Nu am putut actualiza statusul." }, { status: 500 });
  }
  if (!updatedEntry?.id) {
    return NextResponse.json({ error: "Intrarea nu mai exista. Reincarca lista." }, { status: 404 });
  }

  let warning = "";
  if (isActive) {
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id,email")
      .eq("email", email)
      .maybeSingle();
    if (profileError) {
      console.error("[admin/free-access] Profile lookup failed", profileError);
      warning = "Statusul a fost salvat, dar accesul nu a putut fi aplicat imediat.";
    }
    if (!profileError && profile?.id) {
      try {
        await ensurePremiumGrantFromAllowlist({ userId: profile.id, email: profile.email });
      } catch (grantError) {
        console.error("[admin/free-access] Grant activation failed", grantError);
        warning = "Statusul a fost salvat, dar accesul nu a putut fi aplicat imediat.";
      }
    }
  }

  return NextResponse.json({ ok: true, warning });
}
