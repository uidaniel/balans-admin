/**
 * Where waitlist signups are being kept.
 *
 * The public site owns the waitlist: it validates the form, rate-limits it,
 * hashes the signup IP and writes the row. This application only ever reads
 * that table, so all of that came across when the admin was split out and
 * none of it was reachable — including a fallback that writes signups to a
 * local file, which on a serverless host silently loses them.
 *
 * What is left is the one question the dashboard asks: is the store actually
 * configured? Without the service-role key the reads come back empty rather
 * than failing, and an empty waitlist looks the same whether nobody has
 * signed up or the key is missing. The banner exists so nobody has to guess.
 */

import { supabaseConfigured } from "./supabase";

export function storageMode(): "supabase" | "file" {
  return supabaseConfigured && process.env.SUPABASE_SERVICE_ROLE_KEY ? "supabase" : "file";
}
