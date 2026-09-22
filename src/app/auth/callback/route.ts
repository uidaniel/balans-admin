import { NextResponse } from "next/server";
import { userClient } from "@/lib/supabase-server";

/**
 * Where a sign-in link lands.
 *
 * Two shapes arrive here, because Supabase issues two.
 *
 * A link the browser asked for carries `?code=` — the login page signs in
 * through the PKCE flow, and the code is exchanged for a session against the
 * verifier this browser stored when it started.
 *
 * A link generated server-side, with the admin API, carries `?token_hash=`
 * and a `type` instead. There is no verifier for those, so they are verified
 * directly. This is the path that matters when the email service is down or
 * rate-limited and somebody with database access has to hand over a working
 * link — which is exactly when being locked out costs the most.
 *
 * Either way a session cookie is set here, server-side, and nothing sensitive
 * travels in a URL fragment where the server could never see it.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") ?? "magiclink";
  const next = url.searchParams.get("next") ?? "/";

  if (!code && !tokenHash) {
    return NextResponse.redirect(new URL("/login?error=missing_code", url.origin));
  }

  const supabase = await userClient();

  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : await supabase.auth.verifyOtp({
        token_hash: tokenHash!,
        type: type as "magiclink" | "email" | "recovery" | "invite",
      });

  if (error) {
    // The message is not shown to the visitor: an expired link and a link for
    // somebody else should look the same from outside.
    console.error("[admin] sign-in failed", error.message);
    return NextResponse.redirect(new URL("/login?error=expired", url.origin));
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
