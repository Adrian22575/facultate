import "./globals.css";

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { AIJobGlobalNotifier } from "@/components/ai-job-global-notifier";
import { FeedbackLauncherServer } from "@/components/feedback-launcher-server";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://nota5plus.ro";

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: "Nota 5+",
  description: "Invata mai clar, repeta mai rapid, treci mai usor.",
  applicationName: "Nota 5+",
  authors: [{ name: "Nota 5+" }],
  creator: "Nota 5+",
  publisher: "Nota 5+",
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
        {children}
        <AIJobGlobalNotifier />
        <FeedbackLauncherServer />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
