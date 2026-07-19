import Link from "next/link";
import { notFound } from "next/navigation";

import { DictionaryShell, DictionaryTermPage } from "@/components/dictionary-page";
import { requireAdmin } from "@/lib/admin";
import { getDictionaryAdminTermById } from "@/lib/dictionary/server";
import { getPublicSiteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Previzualizare termen | Admin Nota 5+",
  robots: { index: false, follow: false }
};

export default async function AdminDictionaryPreviewPage({ params }) {
  const { termId } = await params;
  await requireAdmin(`/admin/dictionar/${termId}/preview`);
  const term = await getDictionaryAdminTermById(termId);
  if (!term) notFound();

  return (
    <DictionaryShell>
      <aside className="dictionary-admin-preview" role="status">
        <div>
          <span>Previzualizare privată</span>
          <strong>Vezi termenul exact cum va arăta, fără să îl publici.</strong>
        </div>
        <Link href="/admin/continut/dictionar">Înapoi la editare</Link>
      </aside>
      <DictionaryTermPage term={term} siteUrl={getPublicSiteUrl()} isPreview />
    </DictionaryShell>
  );
}
