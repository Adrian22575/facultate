import { FreeToolsIndexPage } from "@/components/free-tools-page";

export const metadata = {
  title: "Instrumente gratuite pentru învățare și examene | Nota 5+",
  description: "Calculatoare gratuite pentru grile, plan de învățare, punctaj la examen și scoruri de simulare.",
  alternates: { canonical: "/instrumente" },
  openGraph: {
    title: "Instrumente gratuite pentru învățare și examene | Nota 5+",
    description: "Planifică grilele, materia, simulările și punctajul examenului fără cont.",
    url: "/instrumente",
    siteName: "Nota 5+",
    locale: "ro_RO",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "Instrumente gratuite pentru învățare | Nota 5+",
    description: "Calculatoare clare pentru grile, materie, punctaj și simulări."
  }
};

export default function FreeToolsPage() {
  return <FreeToolsIndexPage />;
}
