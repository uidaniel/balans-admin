import { serviceClient } from "@/lib/supabase";
import { currentStaff } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

/** The whole list as CSV, for a mail merge at launch. Staff only. */
export async function GET() {
  const staff = await currentStaff();
  if (!staff) return new Response("Forbidden", { status: 403 });

  const { data, error } = await serviceClient()
    .from("waitlist")
    .select("phone, email, work, cadence, source, ref, via, code, details_at, invited_at, created_at")
    .order("created_at", { ascending: false });

  if (error) return new Response(`Could not read the waitlist: ${error.message}`, { status: 500 });

  // Phone first: this file is what the launch broadcast gets built from, and
  // the message goes out on WhatsApp.
  const head = [
    "phone",
    "email",
    "work",
    "cadence",
    "source",
    "ref",
    "via",
    "code",
    "details_at",
    "invited_at",
    "created_at",
  ];
  const lines = [head.join(",")];
  for (const r of data ?? []) {
    lines.push(head.map((k) => csv((r as Record<string, unknown>)[k])).join(","));
  }

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(lines.join("\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="balans-waitlist-${stamp}.csv"`,
      "cache-control": "no-store",
    },
  });
}

/**
 * Quotes a CSV field.
 *
 * The leading apostrophe on anything starting with = + - or @ stops a
 * spreadsheet treating a pasted value as a formula, which is how a waitlist
 * export becomes a phishing vector the moment someone signs up as
 * `=HYPERLINK(...)`.
 */
function csv(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}
