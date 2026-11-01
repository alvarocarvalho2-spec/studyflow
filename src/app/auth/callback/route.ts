import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

function getSafeSiteOrigin(request: NextRequest) {
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configuredSiteUrl) {
    try {
      const url = new URL(configuredSiteUrl);
      const isLoopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
      if (!url.username && !url.password && (url.protocol === "https:" || (url.protocol === "http:" && isLoopback))) {
        return url.origin;
      }
    } catch {
      // A malformed deployment URL must not turn an auth callback into a 500.
    }
  }

  return request.nextUrl.origin;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const siteOrigin = getSafeSiteOrigin(request);
  const redirectTo = (path: string) => {
    const response = NextResponse.redirect(new URL(path, siteOrigin));
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  };

  if (code) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        return redirectTo("/dashboard");
      }
    } catch {
      // Continue to the sign-in route with a generic failure message.
    }
  }

  const signInUrl = new URL("/entrar", siteOrigin);
  signInUrl.searchParams.set("status", "confirmation-failed");
  const response = NextResponse.redirect(signInUrl);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
