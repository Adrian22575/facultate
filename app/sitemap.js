import { getPublicSiteUrl } from "@/lib/site";

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
    }
  ];
}
