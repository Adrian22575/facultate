import { notFound } from "next/navigation";

import { FreeToolPage } from "@/components/free-tools-page";
import { freeTools, getFreeTool } from "@/lib/free-tools";

export function generateStaticParams() {
  return freeTools.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const tool = getFreeTool(slug);
  if (!tool) return {};

  const path = `/instrumente/${tool.slug}`;
  return {
    title: tool.seoTitle,
    description: tool.seoDescription,
    alternates: { canonical: path },
    openGraph: {
      title: tool.seoTitle,
      description: tool.seoDescription,
      url: path,
      siteName: "Nota 5+",
      locale: "ro_RO",
      type: "website"
    },
    twitter: {
      card: "summary_large_image",
      title: tool.seoTitle,
      description: tool.seoDescription
    }
  };
}

export default async function ToolPage({ params }) {
  const { slug } = await params;
  const tool = getFreeTool(slug);
  if (!tool) notFound();
  return <FreeToolPage tool={tool} />;
}
