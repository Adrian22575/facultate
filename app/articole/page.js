import { EditorialIndexClient } from "@/components/editorial-index-client";
import { EditorialBreadcrumbs, EditorialShell } from "@/components/editorial-page";
import { getEditorialOverview } from "@/lib/editorial/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Articole despre educație | Nota 5+", description: "Noutăți verificate despre educație, învățare, examene, școli, universități și tehnologie, explicate pentru România.", alternates: { canonical: "/articole" }, openGraph: { title: "Articole despre educație | Nota 5+", description: "Ediții săptămânale despre schimbările care contează pentru cei care învață.", url: "/articole", type: "website" } };

export default async function EditorialIndexPage() { const overview = await getEditorialOverview(); return <EditorialShell><EditorialBreadcrumbs /><EditorialIndexClient {...overview} /></EditorialShell>; }
