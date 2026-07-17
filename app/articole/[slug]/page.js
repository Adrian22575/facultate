import { notFound } from "next/navigation";

import { EditorialArticlePage, EditorialShell } from "@/components/editorial-page";
import { getEditorialArticle } from "@/lib/editorial/server";
import { getPublicSiteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) { const { slug } = await params; const article = await getEditorialArticle(slug); if (!article) return { title: "Articol indisponibil | Nota 5+" }; return { title: article.seo_title, description: article.meta_description, alternates: { canonical: `/articole/${article.slug}` }, openGraph: { title: article.seo_title, description: article.social_description, url: `/articole/${article.slug}`, type: "article", publishedTime: article.published_at, modifiedTime: article.updated_at }, twitter: { card: "summary", title: article.seo_title, description: article.social_description } }; }

export default async function EditorialArticleRoute({ params }) { const { slug } = await params; const article = await getEditorialArticle(slug); if (!article) notFound(); return <EditorialShell><EditorialArticlePage article={article} siteUrl={getPublicSiteUrl()} /></EditorialShell>; }
