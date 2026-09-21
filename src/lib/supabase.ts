import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase clients.
 *
 * Two of them, and the difference matters:
 *
 *   `serviceClient()` uses the service role key, which bypasses row level
 *   security entirely. It must never be imported into a client component or
 *   any module that ships to the browser. The waitlist table holds email
 *   addresses and has RLS on with no policies, so this key is the only way in.
 *
 *   `anonKey` is safe in the browser and is what the admin login uses. On its
 *   own it can read nothing: being signed in is not the same as being allowed,
 *   which `admin_allowlist` decides separately.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabaseConfigured = Boolean(url && anon);

/** Server-only. Full access; keep it on the server. */
export function serviceClient(): SupabaseClient {
  if (!url || !service) {
    throw new Error(
      "Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "x-application-name": "balans-web" } },
  });
}

export function publicConfig(): { url: string; anonKey: string } {
  if (!url || !anon) {
    throw new Error(
      "Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }
  return { url, anonKey: anon };
}
