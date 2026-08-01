"use client";

import { CircleAlert } from "lucide-react";
import { useEffect } from "react";

import { ActionLink, Button } from "@/components/ui/action";
import { FeedbackState } from "@/components/ui/state";

export default function GlobalRouteError({ error, reset }) {
  useEffect(() => {
    console.error("route_render_failed", error);
  }, [error]);

  return (
    <FeedbackState
      tone="warning"
      icon={<CircleAlert size={30} strokeWidth={2} />}
      eyebrow="Pagina nu s-a incarcat"
      title="A aparut o problema temporara."
      description="Progresul salvat nu este afectat. Incearca din nou sau revino la pagina principala."
      role="alert"
      actions={
        <>
          <Button onClick={reset}>
            Incearca din nou
          </Button>
          <ActionLink href="/" variant="secondary">
            Mergi la pagina principala
          </ActionLink>
        </>
      }
    />
  );
}
