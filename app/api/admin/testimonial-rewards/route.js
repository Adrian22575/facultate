import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { isAdminUser } from "@/lib/admin";
import {
  approveTestimonialRewardSubmission,
  deleteTestimonialRewardSubmission,
  rejectTestimonialRewardSubmission
} from "@/lib/testimonial-rewards";
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

export async function PATCH(request) {
  const adminUser = await requireApiAdmin();
  if (!adminUser) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const id = typeof body?.id === "string" ? body.id : "";
  const action = typeof body?.action === "string" ? body.action : "";
  const adminNote = typeof body?.adminNote === "string" ? body.adminNote : "";

  if (!id || !["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "Payload invalid." }, { status: 400 });
  }

  try {
    const result =
      action === "approve"
        ? await approveTestimonialRewardSubmission({
            submissionId: id,
            adminUserId: adminUser.id,
            adminNote
          })
        : await rejectTestimonialRewardSubmission({
            submissionId: id,
            adminUserId: adminUser.id,
            adminNote
          });

    if (!result.ok) {
      return NextResponse.json(
        { error: "Review-ul nu mai este disponibil pentru aceasta actiune.", reason: result.reason },
        { status: 409 }
      );
    }

    revalidatePath("/admin");
    revalidatePath("/review-reward");

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: "Nu am putut actualiza review-ul." }, { status: 500 });
  }
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
    const result = await deleteTestimonialRewardSubmission({ submissionId: id });

    if (!result.ok) {
      return NextResponse.json(
        { error: "Review-ul nu mai exista.", reason: result.reason },
        { status: 404 }
      );
    }

    revalidatePath("/admin");
    revalidatePath("/review-reward");
    revalidatePath("/cont");

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Nu am putut sterge review-ul." }, { status: 500 });
  }
}
