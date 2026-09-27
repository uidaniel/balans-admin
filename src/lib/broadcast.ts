import { serviceClient } from "@/lib/supabase";
import type { Loaded } from "@/lib/dashboard";

/*
 * What the Broadcast page reads.
 *
 * The copy comes from the API, which writes it to `config` at boot as
 * `broadcast.<campaign>`: the admin is another application and cannot import
 * the file the message is built from, and a preview typed out a second time
 * here would drift from what people actually receive. Template statuses come
 * the same way, as `template_status`, because only the API holds a Meta key.
 */

export const CAMPAIGN = "launch_live";

/** Where a test goes unless somebody types another number. */
export const DEFAULT_TEST_PHONE = "08107408438";

export type Campaign = {
  campaign: string;
  image: string;
  whatsapp: { body: string; footer: string; button: string; link: string };
  email: { subject: string; html: string };
};

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

export type Audience = { people: number; phones: number; emails: number };

export type BroadcastPage = {
  campaign: Campaign | null;
  /** Meta's word for it: APPROVED, PENDING, REJECTED, or null if unknown. */
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

export async function loadBroadcastPage(): Promise<BroadcastPage> {
  const db = serviceClient();
  const live = () => db.from("waitlist").select("id", { count: "exact", head: true }).is("unsubscribed_at", null);

  const [config, people, phones, emails, history] = await Promise.all([
    db.from("config").select("key, value_json, updated_at").in("key", [`broadcast.${CAMPAIGN}`, "template_status"]),
    live(),
    live().not("phone", "is", null),
    live().not("email", "is", null),
    db.from("admin_broadcasts").select("*").eq("campaign", CAMPAIGN).order("created_at", { ascending: false }).limit(30),
  ]);

  const rows = config.data ?? [];
  const campaign = (rows.find((r) => r.key === `broadcast.${CAMPAIGN}`)?.value_json ?? null) as Campaign | null;
  const statuses = rows.find((r) => r.key === "template_status");
  const templateStatus = ((statuses?.value_json as Record<string, string> | undefined)?.[CAMPAIGN] ?? null) as
    | string
    | null;

  const countError = people.error ?? phones.error ?? emails.error;

  return {
    campaign,
    templateStatus,
    statusCheckedAt: (statuses?.updated_at as string | undefined) ?? null,
    audience: countError
      ? { data: null, error: countError.message }
      : { data: { people: people.count ?? 0, phones: phones.count ?? 0, emails: emails.count ?? 0 }, error: null },
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
 * A Nigerian number in the shape the waitlist stores: +234 and ten digits.
 * Also takes a full international number starting with +. Null if neither.
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
