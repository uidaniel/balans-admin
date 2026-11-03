import { serviceClient } from "@/lib/supabase";
import type { Loaded } from "@/lib/dashboard";

/*
 * What the Broadcast page reads (3 November 2026: messages to every user;
 * the waitlist's launch message is retired now Balans is live).
 *
 * The admin never sends. It writes a broadcast with its words and one row per
 * user (API migrations 0029, 0061); the API sends them: free-form to anybody
 * inside WhatsApp's 24-hour window, the `announcement` template to everybody
 * else once Meta approves it, and email to confirmed addresses. Template
 * statuses come from `config`, written by the API, which holds the Meta key.
 */

export const ANNOUNCE = "announcement";

/** Where a test goes unless somebody types another number. */
export const DEFAULT_TEST_PHONE = "08107408438";

/** WhatsApp carries one paragraph in the template, and Meta caps the body. */
export const MAX_MESSAGE = 700;

export type BroadcastRow = {
  id: string;
  campaign: string;
  kind: "test" | "live";
  channels: string[];
  status: "queued" | "sending" | "done" | "failed" | "cancelled";
  created_by: string | null;
  note: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  recipients: number;
  wa_sent: number;
  wa_failed: number;
  wa_pending: number;
  email_sent: number;
  email_failed: number;
  email_pending: number;
  first_phone: string | null;
  first_email: string | null;
  wa_via: string | null;
  wa_error: string | null;
  email_error: string | null;
};

export type Audience = { people: number; emails: number };

export type BroadcastPage = {
  /** Meta's word for the announcement template: APPROVED, PENDING, REJECTED, or null. */
  templateStatus: string | null;
  statusCheckedAt: string | null;
  audience: Loaded<Audience>;
  history: Loaded<BroadcastRow[]>;
};

const COUNTS = [
  "recipients",
  "wa_sent",
  "wa_failed",
  "wa_pending",
  "email_sent",
  "email_failed",
  "email_pending",
] as const;

/**
 * Users an announcement goes to: finished setup, active, said yes to updates
 * and not since said stop (API migrations 0061, 0065). The yes is the box at
 * setup, the one-time question after an invoice, or START UPDATES.
 */
export const audienceQuery = () =>
  serviceClient()
    .from("users")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null)
    .eq("status", "active")
    .not("consented_at", "is", null)
    .not("updates_opt_in_at", "is", null)
    .is("updates_off_at", null);

export async function loadBroadcastPage(): Promise<BroadcastPage> {
  const db = serviceClient();
  const [config, people, emails, history] = await Promise.all([
    db.from("config").select("key, value_json, updated_at").eq("key", "template_status"),
    audienceQuery(),
    audienceQuery().not("email_verified_at", "is", null),
    db.from("admin_broadcasts").select("*").eq("campaign", ANNOUNCE).order("created_at", { ascending: false }).limit(30),
  ]);

  const statuses = (config.data ?? [])[0];
  const templateStatus = ((statuses?.value_json as Record<string, string> | undefined)?.[ANNOUNCE] ?? null) as string | null;
  const countError = people.error ?? emails.error;

  return {
    templateStatus,
    statusCheckedAt: (statuses?.updated_at as string | undefined) ?? null,
    audience: countError
      ? { data: null, error: countError.message }
      : { data: { people: people.count ?? 0, emails: emails.count ?? 0 }, error: null },
    history: history.error
      ? { data: null, error: history.error.message }
      : {
          data: (history.data ?? []).map((r) => {
            const out = { ...r } as Record<string, unknown>;
            for (const k of COUNTS) out[k] = Number(r[k] ?? 0);
            return out as BroadcastRow;
          }),
          error: null,
        },
  };
}

/**
 * A Nigerian number in the shape the recipients table stores: +234 and ten
 * digits. Also takes a full international number starting with +. Null if neither.
 */
export function normalisePhone(input: string): string | null {
  const raw = input.trim();
  const digits = raw.replace(/\D/g, "");
  if (raw.startsWith("+") && digits.length >= 10 && digits.length <= 15) return `+${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `+234${digits.slice(1)}`;
  if (digits.length === 13 && digits.startsWith("234")) return `+${digits}`;
  if (digits.length === 10 && /^[789]/.test(digits)) return `+234${digits}`;
  return null;
}
