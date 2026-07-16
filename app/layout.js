import "./globals.css";

import { Suspense } from "react";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { AIJobGlobalNotifier } from "@/components/ai-job-global-notifier";
import { FeedbackLauncherServer } from "@/components/feedback-launcher-server";
import { GlobalNavigationFeedback } from "@/components/global-navigation-feedback";
import { UsageTracker } from "@/components/usage-tracker";
import { getPublicSiteUrl } from "@/lib/site";

const siteUrl = getPublicSiteUrl();

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: "Nota 5+",
  description: "Invata mai clar, repeta mai rapid, treci mai usor.",
  applicationName: "Nota 5+",
  authors: [{ name: "Nota 5+" }],
  creator: "Nota 5+",
  publisher: "Nota 5+",
  icons: {
    icon: [
      { url: "/favicon.ico?v=2", sizes: "any" },
      { url: "/icon.png?v=2", type: "image/png", sizes: "512x512" }
    ],
    shortcut: ["/favicon.ico?v=2"],
    apple: [{ url: "/apple-icon.png?v=2", type: "image/png", sizes: "180x180" }]
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1
    }
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="ro">
      <body>
        <a className="skip-link" href="#main-content">
          Sari la continut
        </a>
        <div id="main-content" tabIndex={-1}>
          {children}
        </div>
        <UsageTracker />
        <Suspense fallback={null}>
          <GlobalNavigationFeedback />
        </Suspense>
        <AIJobGlobalNotifier />
        <Suspense fallback={null}>
          <FeedbackLauncherServer />
        </Suspense>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
