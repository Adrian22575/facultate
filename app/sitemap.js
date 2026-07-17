import { getPublicSiteUrl } from "@/lib/site";
import { freeTools } from "@/lib/free-tools";

export default function sitemap() {
  const siteUrl = getPublicSiteUrl();
  const now = new Date();

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
    ...freeTools.map((tool) => ({
      url: `${siteUrl}/instrumente/${tool.slug}`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8
    }))
  ];
}
