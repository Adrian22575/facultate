import { getPublicSiteUrl } from "@/lib/site";

export default function robots() {
  const siteUrl = getPublicSiteUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/ai",
          "/api",
          "/auth/callback",
          "/auth/email-login",
          "/auth/login",
          "/auth/reset-password",
          "/billing",
          "/cont",
          "/demo",
          "/licenta-exam",
          "/materiale",
          "/materii",
          "/onboarding",
          "/r/",
          "/review-reward",
          "/setup",
          "/statistici",
          "/testele-mele"
        ]
      }
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl
  };
}
