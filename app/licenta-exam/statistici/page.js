import { redirect } from "next/navigation";

export const metadata = {
  title: "Statistici | Nota 5+"
};

export default function LicentaStatsRedirectPage() {
  redirect("/statistici");
}
