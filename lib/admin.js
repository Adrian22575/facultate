import "server-only";

import { redirect } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/supabase/guards";

const ADMIN_EMAIL = "agentiadiamond@gmail.com";

function normalizeAdminEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export async function requireAdmin(nextPath = "/admin") {
  const user = await requireUser(nextPath);

  const isAdmin = await isAdminUser(user);

  if (!isAdmin) {
    redirect("/");
  }

  return user;
}

export async function isAdminUser(user) {
  if (!user?.id || !user?.email) {
    return false;
  }

  const email = normalizeAdminEmail(user.email);
  if (email !== ADMIN_EMAIL) {
    return false;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .eq("email", ADMIN_EMAIL)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    return false;
  }

  return Boolean(data?.user_id);
}
