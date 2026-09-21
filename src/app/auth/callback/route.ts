import { NextResponse } from "next/server";
import { userClient } from "@/lib/supabase-server";

/**
 * Where the magic link lands. Exchanges the one-time code for a session
 * cookie, then sends the person on to the admin.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/";

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", url.origin));
  }

  const supabase = await userClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("[admin] code exchange failed", error.message);
    return NextResponse.redirect(new URL("/login?error=expired", url.origin));
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
