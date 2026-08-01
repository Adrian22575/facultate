import { LoadingState } from "@/components/ui/state";

export function RouteLoadingState({
  title = "Pregatim pagina.",
  description = "Mai dureaza doar un moment."
}) {
  return <LoadingState title={title} description={description} />;
}
