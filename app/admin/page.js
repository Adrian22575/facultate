import { redirect } from "next/navigation";

import { AdminOverview } from "@/components/admin-overview";
import { AdminPageShell } from "@/components/admin-page-shell";
import { requireAdmin } from "@/lib/admin";
import { getLegacyAdminRedirect } from "@/lib/admin-routes";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin Center | Nota 5+"
};

export default async function AdminPage({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const legacyDestination = getLegacyAdminRedirect(resolvedSearchParams || {});
  if (legacyDestination) redirect(legacyDestination);

  await requireAdmin("/admin");

  return (
    <AdminPageShell>
      <AdminOverview />
    </AdminPageShell>
  );
}
