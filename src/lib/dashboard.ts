import { serviceClient } from "@/lib/supabase";

/*
 * What the dashboard reads, from the views in the API's migration 0027.
 *
 * Every definition — what "unpaid" means, what MRR counts, which documents
 * are invoices — lives in those views, not here. This file only fetches and
 * types them, so the page cannot quietly disagree with the database.
 *
 * Postgres returns bigint aggregates as strings over the REST API, so every
 * figure goes through `n()` rather than being trusted to be a number.
 */

const n = (v: unknown): number => (v === null || v === undefined || v === "" ? 0 : Number(v));

export type Overview = {
  users_total: number;
  users_onboarded: number;
  signups_6h: number;
  signups_12h: number;
  signups_24h: number;
  signups_7d: number;
  signups_30d: number;
  users_active_30d: number;
  waitlist_total: number;
  pro_users: number;
  mrr_kobo: number;
  documents_6h: number;
  documents_12h: number;
  documents_24h: number;
  documents_7d: number;
  documents_30d: number;
  documents_total: number;
  invoices_total: number;
  quotes_total: number;
  requests_total: number;
  foreign_documents: number;
  invoices_paid: number;
  invoices_unpaid: number;
  invoices_part_paid: number;
  invoices_overdue: number;
  invoiced_kobo: number;
  invoiced_30d_kobo: number;
  outstanding_kobo: number;
  payments_count: number;
  collected_kobo: number;
  collected_24h_kobo: number;
  collected_30d_kobo: number;
  collected_by_card_kobo: number;
  processor_fees_kobo: number;
  earned_fees_kobo: number;
  earned_subscriptions_kobo: number;
  earned_30d_kobo: number;
  message_cost_30d_kobo: number;
  messages_out_24h: number;
};

export type Account = {
  id: string;
  wa_phone: string;
  business_name: string | null;
  email: string | null;
  email_verified: boolean;
  plan: string;
  status: string;
  created_at: string;
  onboarded_at: string | null;
  last_active_at: string | null;
  documents: number;
  invoices: number;
  invoices_paid: number;
  invoices_unpaid: number;
  invoiced_kobo: number;
  collected_kobo: number;
  outstanding_kobo: number;
  last_document_at: string | null;
};

export type Day = {
  day: string;
  signups: number;
  documents: number;
  invoiced_kobo: number;
  payments: number;
  collected_kobo: number;
};

export type Payment = {
  id: string;
  reference: string;
  provider: string;
  status: string;
  client_total_kobo: number;
  to_user_kobo: number;
  provider_fee_kobo: number;
  balans_fee_kobo: number;
  at: string;
  document_ref: string | null;
  currency: string;
  business_name: string | null;
  client_name: string | null;
};

/** Numbers where the view sends strings; everything else as it came. */
function numeric<T extends Record<string, unknown>>(row: Record<string, unknown>, strings: string[]): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) out[k] = strings.includes(k) || typeof v === "boolean" ? v : n(v);
  return out as T;
}

export type Loaded<T> = { data: T; error: null } | { data: null; error: string };

/**
 * The one-row overview. An error rather than zeros when the view is missing:
 * a dashboard of confident zeros is worse than one that says it cannot see.
 */
export async function loadOverview(): Promise<Loaded<Overview>> {
  const { data, error } = await serviceClient().from("admin_overview").select("*").single();
  if (error || !data) return { data: null, error: error?.message ?? "no row" };
  return { data: numeric<Overview>(data, []), error: null };
}

export async function loadDaily(): Promise<Loaded<Day[]>> {
  const { data, error } = await serviceClient().from("admin_daily").select("*").order("day");
  if (error || !data) return { data: null, error: error?.message ?? "no rows" };
  return { data: data.map((r) => numeric<Day>(r, ["day"])), error: null };
}

export type AccountSort = "invoiced" | "collected" | "outstanding" | "newest" | "active";

const SORTS: Record<AccountSort, { column: string; ascending: boolean }> = {
  invoiced: { column: "invoiced_kobo", ascending: false },
  collected: { column: "collected_kobo", ascending: false },
  outstanding: { column: "outstanding_kobo", ascending: false },
  newest: { column: "created_at", ascending: false },
  active: { column: "last_active_at", ascending: false },
};

/**
 * Every user, searched by name, phone or email.
 *
 * The search goes to Postgres rather than filtering a page of rows, so it
 * finds somebody past the first thousand. The term is stripped of the
 * characters PostgREST's filter syntax gives meaning to, so a comma or a
 * bracket typed into the box cannot change what is being asked.
 */
export async function loadAccounts(q: string, sort: AccountSort): Promise<Loaded<Account[]>> {
  let query = serviceClient().from("admin_accounts").select("*");
  const term = q.replace(/[,()*%\\]/g, " ").trim();
  if (term) {
    query = query.or(`business_name.ilike.*${term}*,wa_phone.ilike.*${term}*,email.ilike.*${term}*`);
  }
  const s = SORTS[sort] ?? SORTS.invoiced;
  const { data, error } = await query.order(s.column, { ascending: s.ascending, nullsFirst: false }).limit(1000);
  if (error || !data) return { data: null, error: error?.message ?? "no rows" };
  return {
    data: data.map((r) =>
      numeric<Account>(r, [
        "id",
        "wa_phone",
        "business_name",
        "email",
        "plan",
        "status",
        "created_at",
        "onboarded_at",
        "last_active_at",
        "last_document_at",
      ]),
    ),
    error: null,
  };
}

export async function loadPayments(status: string): Promise<Loaded<Payment[]>> {
  let query = serviceClient().from("admin_payments").select("*");
  if (status && status !== "all") query = query.eq("status", status);
  const { data, error } = await query.order("at", { ascending: false }).limit(500);
  if (error || !data) return { data: null, error: error?.message ?? "no rows" };
  return {
    data: data.map((r) =>
      numeric<Payment>(r, [
        "id",
        "reference",
        "provider",
        "status",
        "at",
        "document_ref",
        "currency",
        "business_name",
        "client_name",
      ]),
    ),
    error: null,
  };
}

export type Slice = { k: string | number; n: number; kobo?: number };

export type Insights = {
  funnel_signed_up: number;
  funnel_email_verified: number;
  funnel_set_up: number;
  funnel_first_document: number;
  funnel_first_paid: number;
  funnel_ever_pro: number;
  median_minutes_to_first_document: number | null;
  median_hours_to_paid: number | null;
  users_messaging_24h: number;
  users_messaging_7d: number;
  users_messaging_30d: number;
  avg_invoice_kobo: number;
  median_invoice_kobo: number;
  largest_invoice_kobo: number;
  documents_per_active_user_30d: number | null;
  payments_by_card: number;
  payments_by_transfer: number;
  collected_by_transfer_kobo: number;
  payments_troubled: number;
  receipts_issued: number;
  clients_total: number;
  clients_with_email: number;
  clients_with_phone: number;
  messages_in_30d: number;
  messages_out_30d: number;
  templates_out_30d: number;
  reminders_sent_30d: number;
  reminders_pending: number;
  reminders_failed: number;
  referrals_total: number;
  referrals_credited: number;
  risk_flags_open: number;
  parses_30d: number;
  parser_avg_ms: number | null;
  documents_by_status: Slice[];
  documents_by_currency: Slice[];
  designs: Slice[];
  waitlist_sources: Slice[];
  messages_by_kind_30d: Slice[];
  documents_by_hour: Slice[];
};

const BREAKDOWNS = [
  "documents_by_status",
  "documents_by_currency",
  "designs",
  "waitlist_sources",
  "messages_by_kind_30d",
  "documents_by_hour",
];
/** Figures that mean "no data yet" when null, rather than zero. */
const NULLABLE = ["median_minutes_to_first_document", "median_hours_to_paid", "documents_per_active_user_30d", "parser_avg_ms"];

export async function loadInsights(): Promise<Loaded<Insights>> {
  const { data, error } = await serviceClient().from("admin_insights").select("*").single();
  if (error || !data) return { data: null, error: error?.message ?? "no row" };
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
    if (BREAKDOWNS.includes(k)) {
      out[k] = ((v as Slice[] | null) ?? []).map((s) => ({ k: s.k, n: n(s.n), ...(s.kobo === undefined ? {} : { kobo: n(s.kobo) }) }));
    } else if (NULLABLE.includes(k)) {
      out[k] = v === null ? null : n(v);
    } else {
      out[k] = n(v);
    }
  }
  return { data: out as Insights, error: null };
}
