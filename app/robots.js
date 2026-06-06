const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://nota5plus.ro";

export default function robots() {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/cont", "/api", "/auth/callback", "/setup"]
      }
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl
  };
}
