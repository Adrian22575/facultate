import { notFound } from "next/navigation";

import { AdminDictionaryPanel } from "@/components/admin-dictionary-panel";
import { AdminPageShell } from "@/components/admin-page-shell";
import { requireAdmin } from "@/lib/admin";
import { getAdminRoute } from "@/lib/admin-routes";
import { getDictionaryAdminEditorWorkspace } from "@/lib/dictionary/server";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  return { title: "Editare termen | Admin Nota 5+" };
}

export default async function AdminDictionaryTermRoute({ params }) {
  const { termId } = await params;
  await requireAdmin(`/admin/continut/dictionar/${termId}`);

  const { categories, term } = await getDictionaryAdminEditorWorkspace(termId);
  if (!term) notFound();

  return (
    <AdminPageShell
      activeRoute={getAdminRoute("/admin/continut/dictionar")}
      breadcrumbLabel="Editare termen"
      hideHeader
    >
      <AdminDictionaryPanel categories={categories} terms={[term]} detail />
    </AdminPageShell>
  );
}
