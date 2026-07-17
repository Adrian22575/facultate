import { notFound } from "next/navigation";

import { DictionaryShell, DictionaryTermPage } from "@/components/dictionary-page";
import { getDictionaryTerm } from "@/lib/dictionary/server";
import { getPublicSiteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const term = await getDictionaryTerm(slug);
  if (!term) return { title: "Termen indisponibil | Nota 5+" };
  return { title: term.seo_title, description: term.meta_description, alternates: { canonical: `/dictionar/${term.slug}` }, openGraph: { title: term.seo_title, description: term.meta_description, url: `/dictionar/${term.slug}`, type: "article", publishedTime: term.published_at, modifiedTime: term.updated_at }, twitter: { card: "summary", title: term.seo_title, description: term.meta_description } };
}

export default async function DictionaryTermRoute({ params }) {
  const { slug } = await params;
  const term = await getDictionaryTerm(slug);
  if (!term) notFound();
  return <DictionaryShell><DictionaryTermPage term={term} siteUrl={getPublicSiteUrl()} /></DictionaryShell>;
}
