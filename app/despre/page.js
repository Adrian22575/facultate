import { PublicHomePage } from "@/components/public-home-page";

export const metadata = {
  title: "Despre Nota 5+ | Invatare rapida pentru elevi si studenti",
  description:
    "Afla cum Nota 5+ ajuta elevii si studentii sa invete mai rapid cu teste grila, recapitulare, mod studiu si simulare de licenta.",
  alternates: {
    canonical: "/despre"
  }
};

export default function DesprePage() {
  return <PublicHomePage />;
}
