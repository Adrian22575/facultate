import { NextResponse } from "next/server";

import { deleteAccountData } from "@/lib/account-deletion";
import { isAdminUser } from "@/lib/admin";
import { DEMO_USER_ID } from "@/lib/demo-user";
import { assertRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

const DELETE_CONFIRMATION = "STERGE CONTUL";

function isTrustedMutation(request) {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") return false;

  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

export async function DELETE(request) {
  if (!isTrustedMutation(request)) {
    return NextResponse.json({ error: "Cererea nu este permisa." }, { status: 403 });
  }

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Trebuie sa fii autentificat." }, { status: 401 });
  }

  if (user.id === DEMO_USER_ID) {
    return NextResponse.json({ error: "Contul demo nu poate fi sters." }, { status: 403 });
  }

  if (await isAdminUser(user)) {
    return NextResponse.json(
      { error: "Contul administrator este protejat. Foloseste un alt administrator pentru aceasta operatie." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => ({}));
  if (body?.confirmation !== DELETE_CONFIRMATION) {
    return NextResponse.json({ error: `Scrie exact ${DELETE_CONFIRMATION} pentru confirmare.` }, { status: 400 });
  }

  try {
    await assertRateLimit({
      action: "account_delete",
      subject: user.id,
      windowSeconds: 60 * 60,
      maxRequests: 3
    });

    await deleteAccountData(user.id);
    await supabase.auth.signOut({ scope: "local" }).catch(() => {});

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("account_self_delete_failed", {
      code: typeof error === "object" && error && "code" in error ? error.code : null
    });

    if (error?.code === "RATE_LIMITED") {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }

    return NextResponse.json(
      { error: "Contul nu a putut fi sters acum. Incearca din nou sau foloseste adresa de contact din politica de confidentialitate." },
      { status: 500 }
    );
  }
}
