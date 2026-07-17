import { getPublicSiteUrl } from "@/lib/site";
import { freeTools } from "@/lib/free-tools";
import { getDictionarySitemapEntries } from "@/lib/dictionary/server";
import { getEditorialSitemapEntries } from "@/lib/editorial/server";

export default async function sitemap() {
  const siteUrl = getPublicSiteUrl();
  const now = new Date();
  const dictionaryTerms = await getDictionarySitemapEntries().catch(() => []);
  const editorialArticles = await getEditorialSitemapEntries().catch(() => []);

  return [
    {
      url: siteUrl,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1
    },
    {
      url: `${siteUrl}/despre`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8
    },
    {
      url: `${siteUrl}/preturi`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7
    },
    {
      url: `${siteUrl}/confidentialitate`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.4
    },
    {
      url: `${siteUrl}/termeni`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.4
    },
    {
      url: `${siteUrl}/instrumente`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9
    },
    {
      url: `${siteUrl}/dictionar`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9
    },
    {
      url: `${siteUrl}/articole`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9
    },
    {
      url: `${siteUrl}/politica-editoriala`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.45
    },
    ...dictionaryTerms.map((term) => ({
      url: `${siteUrl}/dictionar/${term.slug}`,
      lastModified: new Date(term.updated_at || now),
      changeFrequency: "monthly",
      priority: 0.75
    })),
    ...editorialArticles.map((article) => ({
      url: `${siteUrl}/articole/${article.slug}`,
      lastModified: new Date(article.updated_at || now),
      changeFrequency: "monthly",
      priority: 0.8
    })),
    ...freeTools.map((tool) => ({
      url: `${siteUrl}/instrumente/${tool.slug}`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8
    }))
  ];
}
