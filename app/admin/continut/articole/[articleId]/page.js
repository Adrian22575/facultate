import { notFound } from "next/navigation";

import { AdminEditorialArticlePage } from "@/components/admin-editorial-article-page";
import { AdminPageShell } from "@/components/admin-page-shell";
import { requireAdmin } from "@/lib/admin";
import { getAdminRoute } from "@/lib/admin-routes";
import { getEditorialAdminArticleWorkspace } from "@/lib/editorial/server";
import { getLinkedInAdminOverview } from "@/lib/linkedin/server";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  return {
    title: "Editare articol | Admin Nota 5+"
  };
}

export default async function AdminEditorialArticleRoute({ params, searchParams }) {
  const { articleId } = await params;
  const resolvedSearchParams = await searchParams;
  await requireAdmin(`/admin/continut/articole/${articleId}`);

  const [{ article, runs }, linkedIn] = await Promise.all([
    getEditorialAdminArticleWorkspace(articleId),
    getLinkedInAdminOverview()
  ]);
  if (!article) notFound();

  const articlesRoute = getAdminRoute("/admin/continut/articole");
  return (
    <AdminPageShell
      activeRoute={articlesRoute}
      breadcrumbLabel="Editare articol"
      hideHeader
    >
      <AdminEditorialArticlePage
        initialArticle={article}
        runs={runs}
        linkedIn={linkedIn}
        initialLinkedInPostId={resolvedSearchParams?.linkedin_post || ""}
      />
    </AdminPageShell>
  );
}
