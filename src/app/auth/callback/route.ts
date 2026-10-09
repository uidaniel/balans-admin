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
 * directly. That path matters precisely when the ordinary one is unavailable
 * — Supabase's built-in email sender is fixed at two messages an hour — and
 * being locked out of the back office is when it costs most.
 *
 * Either way the session cookie is set here, server-side, rather than
 * arriving in a URL fragment the server could never read.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") ?? "magiclink";
  const next = url.searchParams.get("next") ?? "/";

  if (!code && !tokenHash) return back("/login?error=missing_code");

  const supabase = await userClient();

  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : await supabase.auth.verifyOtp({
        token_hash: tokenHash!,
        type: type as "magiclink" | "email" | "recovery" | "invite",
      });

  if (error) {
    // Not shown to the visitor: an expired link and somebody else's link
    // should look identical from outside.
    console.error("[admin] sign-in failed", error.message);
    return back("/login?error=expired");
  }

  // Only a path is ever allowed through, so `?next=https://elsewhere` cannot
  // turn a sign-in link into an open redirect.
  // A backslash too: browsers read "/\evil.com" as "//evil.com".
  return back(next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : "/");
}

/**
 * Redirects to a path, never to an origin.
 *
 * Netlify serves this site on two hostnames — `admin-balans.netlify.app` and
 * the branch's `main--admin-balans.netlify.app` — and inside the function the
 * request's own origin is the branch one whichever the browser used. Building
 * an absolute redirect from it therefore moved people across hostnames
 * mid-sign-in, and the session cookie, set for the host the browser actually
 * asked, was not sent to the other. The result was a loop: sign in, get
 * bounced to the branch host, appear signed out, land back on the login page.
 *
 * A relative Location is resolved by the browser against the URL it used, so
 * nobody moves hosts and the cookie keeps working. It is also the only form
 * that stays correct on a custom domain, a deploy preview and localhost
 * without any of them being configured anywhere.
 */
function back(path: string): Response {
  return new Response(null, { status: 303, headers: { location: path } });
}
