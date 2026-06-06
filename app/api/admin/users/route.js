import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { isAdminUser } from "@/lib/admin";
import { deleteAdminUserForTesting } from "@/lib/admin-center";
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

export async function DELETE(request) {
  const adminUser = await requireApiAdmin();
  if (!adminUser) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const id = typeof body?.id === "string" ? body.id : "";

  if (!id) {
    return NextResponse.json({ error: "Payload invalid." }, { status: 400 });
  }

  try {
    const result = await deleteAdminUserForTesting({
      targetUserId: id,
      adminUserId: adminUser.id
    });

    if (!result.ok) {
      const status = result.reason === "cannot_delete_self" ? 400 : 404;
      return NextResponse.json(
        {
          error:
            result.reason === "cannot_delete_self"
              ? "Nu iti poti sterge propriul cont admin."
              : "Utilizatorul nu mai exista.",
          reason: result.reason
        },
        { status }
      );
    }

    revalidatePath("/admin");
    revalidatePath("/cont");
    revalidatePath("/onboarding");

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nu am putut sterge utilizatorul." },
      { status: 500 }
    );
  }
}
