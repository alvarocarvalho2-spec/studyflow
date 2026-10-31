import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  if (code) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        return NextResponse.redirect(new URL("/dashboard", siteUrl));
      }
    } catch {
      // Continue to the sign-in route with a generic failure message.
    }
  }

  const signInUrl = new URL("/entrar", siteUrl);
  signInUrl.searchParams.set("status", "confirmation-failed");
  return NextResponse.redirect(signInUrl);
}
