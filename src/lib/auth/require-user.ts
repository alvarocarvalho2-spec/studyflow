import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requireUser(redirectTo?: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const userId = claims?.sub;

  if (error || typeof userId !== "string") {
    redirect(redirectTo ? `/entrar?redirectTo=${encodeURIComponent(redirectTo)}` : "/entrar");
  }

  return {
    id: userId,
    email: typeof claims?.email === "string" ? claims.email : null,
    supabase,
  };
}
