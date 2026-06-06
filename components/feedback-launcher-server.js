import { getOptionalUser } from "@/lib/supabase/guards";

import { FeedbackLauncher } from "@/components/feedback-launcher";

export async function FeedbackLauncherServer() {
  const user = await getOptionalUser();

  if (!user) {
    return null;
  }

  return <FeedbackLauncher />;
}
