import { NextResponse } from "next/server";

import { isAdminUser } from "@/lib/admin";
import { getAdminFreeAccessOverview } from "@/lib/free-access";
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

export async function GET() {
  const adminUser = await requireApiAdmin();
  if (!adminUser) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const data = await getAdminFreeAccessOverview();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Nu am putut incarca lista de acces gratuit." }, { status: 500 });
  }
}
