import { SearchX } from "lucide-react";

import { PendingNavigationLink } from "@/components/pending-navigation-link";
import { ActionLink } from "@/components/ui/action";
import { FeedbackState } from "@/components/ui/state";

export const metadata = {
  title: "Pagina nu a fost gasita | Nota 5+",
  robots: {
    index: false,
    follow: false
  }
};

export default function NotFoundPage() {
  return (
    <FeedbackState
      icon={<SearchX size={30} strokeWidth={2} />}
      eyebrow="Eroare 404"
      title="Pagina aceasta nu mai este aici."
      description="Adresa poate fi gresita sau continutul a fost mutat. Poti reveni imediat la o zona sigura."
      actions={
        <>
          <ActionLink
            as={PendingNavigationLink}
            href="/"
            pendingLabel="Se deschide pagina principala..."
            pendingMode="replace"
          >
            Mergi la pagina principala
          </ActionLink>
          <ActionLink
            as={PendingNavigationLink}
            href="/materiale"
            pendingLabel="Se deschid materialele..."
            pendingMode="replace"
            variant="secondary"
          >
            Deschide materialele
          </ActionLink>
        </>
      }
    />
  );
}
