import Link from "next/link";
import { notFound } from "next/navigation";

import { EditorialArticlePage, EditorialShell } from "@/components/editorial-page";
import { requireAdmin } from "@/lib/admin";
import { getEditorialAdminArticleById } from "@/lib/editorial/server";
import { getPublicSiteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Previzualizare articol | Admin Nota 5+",
  robots: { index: false, follow: false }
};

export default async function AdminEditorialPreviewPage({ params }) {
  const { articleId } = await params;
  await requireAdmin(`/admin/articole/${articleId}/preview`);
  const article = await getEditorialAdminArticleById(articleId);

  if (!article) notFound();

  return (
    <EditorialShell>
      <aside className="editorial-admin-preview" role="status">
        <div>
          <span>Previzualizare privată</span>
          <strong>Vezi articolul exact cum va arăta, fără să îl publici.</strong>
        </div>
        <Link href="/admin/continut/articole">Înapoi la editare</Link>
      </aside>
      <EditorialArticlePage article={article} siteUrl={getPublicSiteUrl()} isPreview />
    </EditorialShell>
  );
}
