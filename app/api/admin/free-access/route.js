import { NextResponse } from "next/server";

import { isAdminUser } from "@/lib/admin";
import { normalizeEmail, parseEmailList } from "@/lib/free-access";
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

  return NextResponse.json({
    inserted: valid.length,
    total: valid.length + invalid.length,
    invalid
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
  const { error } = await admin
    .from("free_access_allowlist")
    .update({
      is_active: isActive,
      added_by: adminUser.id
    })
    .eq("id", id)
    .eq("email", email);

  if (error) {
    return NextResponse.json({ error: "Nu am putut actualiza statusul." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
