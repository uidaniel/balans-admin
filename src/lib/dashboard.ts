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
 * The search, as a PostgREST `or` filter, or null for none.
 *
 * It goes to Postgres rather than filtering a page of rows, so it finds
 * somebody past the first thousand. The term is stripped of the characters
 * PostgREST's filter syntax gives meaning to, so a comma or a bracket typed
 * into the box cannot change what is being asked.
 */
function searchFilter(q: string): string | null {
  const term = q.replace(/[,()*%\\]/g, " ").trim();
  return term ? `business_name.ilike.*${term}*,wa_phone.ilike.*${term}*,email.ilike.*${term}*` : null;
}

/**
 * Users, searched by name, phone or email.
 *
 * A user is somebody who finished setup (`onboarded_at`, which is
 * `consented_at`); `finishedOnly` false adds everybody who started and did
 * not, for the Users page's toggle and for the Overview's lists.
 */
export async function loadAccounts(q: string, sort: AccountSort, finishedOnly = false): Promise<Loaded<Account[]>> {
  let query = serviceClient().from("admin_accounts").select("*");
  const search = searchFilter(q);
  if (search) query = query.or(search);
  if (finishedOnly) query = query.not("onboarded_at", "is", null);
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

/** How many matching accounts have not finished setup, for "Show unfinished (N)". */
export async function countUnfinished(q: string): Promise<number | null> {
  let query = serviceClient().from("admin_accounts").select("id", { count: "exact", head: true }).is("onboarded_at", null);
  const search = searchFilter(q);
  if (search) query = query.or(search);
  const { count, error } = await query;
  return error ? null : (count ?? 0);
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

/*
 * Setup, and the nudges for somebody who stopped part-way (API migration 0050).
 *
 * Read from `users` rather than a view: no admin_* view carries the nudge
 * stamps yet. "Finished setup" is `consented_at` set, as in admin_overview
 * and the funnel; "finished after a nudge" is `activated_setup_at` later
 * than the stamp. Both stamps are set when the job claims somebody, before
 * the send, so a nudge WhatsApp then would not deliver still counts as sent.
 *
 * Email is asked after the first invoice now, not before setup, so it is
 * counted among those who finished setup rather than as a step before it.
 * So is a bank account, which setup lets them skip: `banked` is those who
 * finished setup and have somewhere to be paid, the funnel's third step.
 */
export type Setup = {
  /** Finished setup: what the dashboard calls a user. */
  finished: number;
  finished24h: number;
  /** Setups finished per Lagos day (YYYY-MM-DD), to line up with admin_daily. */
  finishedOn: Record<string, number>;
  /** Finished setup and has somewhere to be paid (loadPaidTo). */
  banked: number;
  emailVerified: number;
  nudged: number;
  nudgedFinished: number;
  followedUp: number;
  followedUpFinished: number;
  stuck: number;
  stuckNudged: number;
};

type Stamps = {
  consented_at: string | null;
  activated_setup_at: string | null;
  setup_nudge_at: string | null;
  setup_followup_at: string | null;
};

const after = (a: string | null, b: string | null) => a !== null && b !== null && new Date(a) > new Date(b);

/** Every row a query matches, a page at a time: PostgREST stops at a thousand. */
async function allRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
): Promise<{ rows: T[]; error: string | null }> {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await page(from, from + 999);
    if (error || !data) return { rows, error: error?.message ?? "no rows" };
    rows.push(...(data as T[]));
    if (data.length < 1000) return { rows, error: null };
  }
}

/**
 * Who has somewhere to be paid: an active bank account, or, for somebody
 * paid from abroad to details of their own (PayPal, Wise and the like, API
 * migration 0034), `abroad_pay_by = 'own'` with those details filled in.
 * They have no Nigerian account and need none, so they count as set up to
 * be paid. Bank details became skippable in setup, so "finished setup" no
 * longer means this.
 *
 * A pending row is not enough: setup's account stays pending until it is
 * confirmed, and nothing settles to it before then.
 */
export async function loadPaidTo(): Promise<Loaded<Set<string>>> {
  const sb = serviceClient();
  const [banks, own] = await Promise.all([
    allRows<{ user_id: string }>((a, b) =>
      sb.from("bank_accounts").select("user_id").eq("status", "active").order("id").range(a, b),
    ),
    allRows<{ id: string; payment_details: string | null }>((a, b) =>
      sb
        .from("users")
        .select("id, payment_details")
        .eq("abroad_pay_by", "own")
        .not("payment_details", "is", null)
        .order("id")
        .range(a, b),
    ),
  ]);
  const error = banks.error ?? own.error;
  if (error) return { data: null, error };
  return {
    data: new Set([
      ...banks.rows.map((r) => r.user_id),
      ...own.rows.filter((r) => (r.payment_details ?? "").trim() !== "").map((r) => r.id),
    ]),
    error: null,
  };
}

export async function loadSetup(): Promise<Loaded<Setup>> {
  const sb = serviceClient();
  const users = () => sb.from("users").select("id", { count: "exact", head: true }).is("deleted_at", null);

  const [finished, verified, stuck, nudged, paidTo] = await Promise.all([
    allRows<{ id: string; consented_at: string }>((a, b) =>
      sb
        .from("users")
        .select("id, consented_at")
        .is("deleted_at", null)
        .not("consented_at", "is", null)
        .order("id")
        .range(a, b),
    ),
    users().not("consented_at", "is", null).not("email_verified_at", "is", null),
    users().is("consented_at", null),
    // Everybody either nudge reached; comparing two columns cannot be a filter.
    allRows<Stamps>((a, b) =>
      sb
        .from("users")
        .select("consented_at, activated_setup_at, setup_nudge_at, setup_followup_at")
        .is("deleted_at", null)
        .or("setup_nudge_at.not.is.null,setup_followup_at.not.is.null")
        .order("id")
        .range(a, b),
    ),
    loadPaidTo(),
  ]);
  const error = finished.error ?? verified.error?.message ?? stuck.error?.message ?? nudged.error ?? paidTo.error;
  if (error) return { data: null, error };

  const dayOf = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" });
  const finishedOn: Record<string, number> = {};
  for (const r of finished.rows) {
    const day = dayOf.format(new Date(r.consented_at));
    finishedOn[day] = (finishedOn[day] ?? 0) + 1;
  }
  const dayAgo = Date.now() - 24 * 3600_000;

  const chat = nudged.rows.filter((r) => r.setup_nudge_at !== null);
  const followed = nudged.rows.filter((r) => r.setup_followup_at !== null);
  return {
    data: {
      finished: finished.rows.length,
      finished24h: finished.rows.filter((r) => new Date(r.consented_at).getTime() > dayAgo).length,
      finishedOn,
      banked: finished.rows.filter((r) => paidTo.data!.has(r.id)).length,
      emailVerified: verified.count ?? 0,
      nudged: chat.length,
      nudgedFinished: chat.filter((r) => after(r.activated_setup_at, r.setup_nudge_at)).length,
      followedUp: followed.length,
      followedUpFinished: followed.filter((r) => after(r.activated_setup_at, r.setup_followup_at)).length,
      stuck: stuck.count ?? 0,
      stuckNudged: nudged.rows.filter((r) => r.consented_at === null).length,
    },
    error: null,
  };
}

/*
 * What WhatsApp costs, as Meta reports it (API migration 0051).
 *
 * Two sources, both Meta's own. Spend is what Meta charged, synced daily from
 * its pricing analytics; it lags a day, so `spend_reported_through` says how
 * far it goes. Counts are every message Meta priced, from its delivery
 * reports: billable or free, by category. Nothing here is an estimate, and
 * spend stays null rather than zero when Meta has not reported it.
 */
export type WhatsAppSlice = { category: string; pricing_type: string; messages: number; billable?: number; cost?: number; cost_kobo?: number | null };
export type WhatsAppDay = { day: string; cost_kobo: number | null; reported: boolean; billable: number };
export type WhatsApp = {
  spend_30d_kobo: number | null;
  spend_30d: number | null;
  spend_currency: string | null;
  spend_unconverted_days: number;
  spend_reported_through: string | null;
  spend_synced_at: string | null;
  reported_messages_30d: number;
  priced_messages_30d: number;
  billable_messages_30d: number;
  free_messages_30d: number;
  sent_messages_30d: number;
  priced_by_category: WhatsAppSlice[];
  spend_by_category: WhatsAppSlice[];
  daily: WhatsAppDay[];
};

const maybe = (v: unknown): number | null => (v === null || v === undefined || v === "" ? null : Number(v));

export async function loadWhatsApp(): Promise<Loaded<WhatsApp>> {
  const { data, error } = await serviceClient().from("admin_whatsapp").select("*").single();
  if (error || !data) return { data: null, error: error?.message ?? "no row" };
  const r = data as Record<string, unknown>;
  const slices = (v: unknown): WhatsAppSlice[] =>
    ((v as Record<string, unknown>[] | null) ?? []).map((s) => ({
      category: String(s.category ?? "unknown"),
      pricing_type: String(s.pricing_type ?? "unknown"),
      messages: n(s.messages),
      ...(s.billable === undefined ? {} : { billable: n(s.billable) }),
      ...(s.cost === undefined ? {} : { cost: n(s.cost) }),
      ...(s.cost_kobo === undefined ? {} : { cost_kobo: maybe(s.cost_kobo) }),
    }));
  return {
    data: {
      spend_30d_kobo: maybe(r.spend_30d_kobo),
      spend_30d: maybe(r.spend_30d),
      spend_currency: (r.spend_currency as string | null) ?? null,
      spend_unconverted_days: n(r.spend_unconverted_days),
      spend_reported_through: (r.spend_reported_through as string | null) ?? null,
      spend_synced_at: (r.spend_synced_at as string | null) ?? null,
      reported_messages_30d: n(r.reported_messages_30d),
      priced_messages_30d: n(r.priced_messages_30d),
      billable_messages_30d: n(r.billable_messages_30d),
      free_messages_30d: n(r.free_messages_30d),
      sent_messages_30d: n(r.sent_messages_30d),
      priced_by_category: slices(r.priced_by_category),
      spend_by_category: slices(r.spend_by_category),
      daily: ((r.daily as Record<string, unknown>[] | null) ?? []).map((d) => ({
        day: String(d.day),
        cost_kobo: maybe(d.cost_kobo),
        reported: Boolean(d.reported),
        billable: n(d.billable),
      })),
    },
    error: null,
  };
}

/** Paystack's page where subaccounts are ticked and verified. */
export const PAYSTACK_SUBACCOUNTS_URL = "https://dashboard.paystack.com/#/subaccounts";

/**
 * Users whose Paystack subaccount is not verified yet.
 *
 * Paystack holds a client's card payment to an unverified subaccount
 * indefinitely and has no API to verify one, so this is a job for staff, and
 * the API keeps the status current hourly (payments/subaccount-verification.ts
 * in the API). Keyed by user id for the users list.
 */
export async function loadUnverifiedSubaccounts(): Promise<Loaded<{ userId: string; business: string | null }[]>> {
  const { data, error } = await serviceClient()
    .from("bank_accounts")
    .select("user_id, users(business_name)")
    .eq("status", "active")
    .eq("paystack_subaccount_status", "unverified");
  if (error || !data) return { data: null, error: error?.message ?? "no rows" };
  return {
    data: data.map((r) => {
      const u = r.users as { business_name: string | null } | { business_name: string | null }[] | null;
      const one = Array.isArray(u) ? u[0] : u;
      return { userId: r.user_id as string, business: one?.business_name ?? null };
    }),
    error: null,
  };
}

/* -------------------------------------------------------------------------- */
/* Where sign-ups come from (3 November 2026)                                  */
/* -------------------------------------------------------------------------- */

/**
 * Recorded by the bot from each person's first message (API migration 0060):
 * a Click-to-WhatsApp ad or boosted post (Meta's referral), the website's chat
 * buttons ("Hi Balans", with a ?ref), the waitlist's launch message, or
 * anything else. Null for everybody before it was recorded.
 */
export const SOURCE_NAME: Record<string, string> = {
  ad: "Ads",
  post: "Boosted posts",
  instagram: "Instagram",
  whatsapp: "Shared on WhatsApp",
  x: "X",
  facebook: "Facebook",
  invoice: "From invoices",
  website: "Website",
  waitlist: "Waitlist",
  direct: "Direct",
  none: "Before tracking",
};

/**
 * Our link tags, each a channel of its own (3 November 2026). The bot stores
 * them as a website ref, from "Hi Balans (ref: ig)", whether the person came
 * through the website's chat button or straight in by balans.ng/start?ref=ig
 * (the Instagram bio, a status, a group): either way it is that channel.
 */
const TAGS: Record<string, { source: string; label: string }> = {
  ig: { source: "instagram", label: "Instagram" },
  status: { source: "whatsapp", label: "WhatsApp status" },
  groups: { source: "whatsapp", label: "WhatsApp groups" },
  wa: { source: "whatsapp", label: "WhatsApp" },
  channel: { source: "whatsapp", label: "WhatsApp channel" },
  x: { source: "x", label: "X" },
  fb: { source: "facebook", label: "Facebook" },
  // "Made with Balans" on a free invoice, tapped by the client (API 0063).
  invoice: { source: "invoice", label: "Made with Balans on an invoice" },
};

const tagOf = (source: string | null, detail: string | null) =>
  source === "website" && detail ? TAGS[detail.toLowerCase()] : undefined;

/** The row a sign-up counts under: a tagged link is its channel, not "Website". */
const channelOf = (source: string | null, detail: string | null): string => tagOf(source, detail)?.source ?? source ?? "none";

/** "Ad: Get paid on WhatsApp", "WhatsApp status", "Website · promo", "Direct". */
export function sourceLabel(source: string | null, detail: string | null): string {
  if (!source) return SOURCE_NAME.none!;
  const tag = tagOf(source, detail);
  if (tag) return tag.label;
  if ((source === "ad" || source === "post") && detail) return `${source === "ad" ? "Ad" : "Post"}: ${detail}`;
  if (source === "website" && detail) return `Website · ${detail}`;
  return SOURCE_NAME[source] ?? source;
}

/** `clicks` is taps on our tagged links (API migration 0062); null where there is no link to tap. */
export type SourceRow = { source: string; clicks: number | null; signedUp: number; finished: number; sent: number; paid: number; pro: number };
export type SourceDetail = { label: string; clicks: number | null; signedUp: number; finished: number; sent: number };
export type Sources = { rows: SourceRow[]; detail: SourceDetail[] };

type SourceUser = { id: string; signup_source: string | null; signup_detail: string | null; consented_at: string | null; plan: string | null };

/** Each user's source, for the Users page. */
export async function loadSourceMap(): Promise<Map<string, string>> {
  const sb = serviceClient();
  const { rows } = await allRows<SourceUser>((a, b) =>
    sb.from("users").select("id, signup_source, signup_detail").is("deleted_at", null).order("id").range(a, b),
  );
  return new Map(rows.map((u) => [u.id, sourceLabel(u.signup_source, u.signup_detail)]));
}

/**
 * Sign-ups per source, and how far each got: finished setup, sent an
 * invoice, got paid, went Pro. The point is which channel brings people who
 * stay, not only who taps. Ads and website refs are broken down by name.
 */
export async function loadSources(): Promise<Loaded<Sources>> {
  const sb = serviceClient();
  const [users, accounts, taps] = await Promise.all([
    allRows<SourceUser>((a, b) =>
      sb.from("users").select("id, signup_source, signup_detail, consented_at, plan").is("deleted_at", null).order("id").range(a, b),
    ),
    allRows<{ id: string; invoices: number; invoices_paid: number }>((a, b) =>
      sb.from("admin_accounts").select("id, invoices, invoices_paid").order("id").range(a, b),
    ),
    sb.from("admin_link_clicks").select("ref, clicks"),
  ]);
  const error = users.error ?? accounts.error;
  if (error) return { data: null, error };

  const docs = new Map(accounts.rows.map((r) => [r.id, r]));
  const by = new Map<string, SourceRow>();
  const detail = new Map<string, SourceDetail>();
  const blank = (source: string): SourceRow => ({ source, clicks: null, signedUp: 0, finished: 0, sent: 0, paid: 0, pro: 0 });
  for (const u of users.rows) {
    const key = channelOf(u.signup_source, u.signup_detail);
    const row = by.get(key) ?? blank(key);
    const d = docs.get(u.id);
    const finished = Boolean(u.consented_at);
    const sent = Number(d?.invoices ?? 0) > 0;
    row.signedUp += 1;
    if (finished) row.finished += 1;
    if (sent) row.sent += 1;
    if (Number(d?.invoices_paid ?? 0) > 0) row.paid += 1;
    if (u.plan === "pro") row.pro += 1;
    by.set(key, row);
    if (u.signup_detail && (key === "ad" || key === "post" || key === "whatsapp" || key === "website")) {
      const label = sourceLabel(u.signup_source, u.signup_detail);
      const x = detail.get(label) ?? { label, clicks: null, signedUp: 0, finished: 0, sent: 0 };
      x.signedUp += 1;
      if (finished) x.finished += 1;
      if (sent) x.sent += 1;
      detail.set(label, x);
    }
  }
  // Taps on the tagged links, under the same rows. Plain /start is the launch
  // message's button; an untagged ref is a website one. Missing until 0062 is
  // live, so a failure here only leaves the column empty.
  for (const t of (taps.data ?? []) as { ref: string; clicks: number }[]) {
    const ref = t.ref.toLowerCase();
    const key = ref === "launch" ? "waitlist" : channelOf("website", ref);
    const row = by.get(key) ?? blank(key);
    row.clicks = (row.clicks ?? 0) + Number(t.clicks);
    by.set(key, row);
    if (key === "whatsapp" || key === "website") {
      const label = sourceLabel("website", ref);
      const x = detail.get(label) ?? { label, clicks: null, signedUp: 0, finished: 0, sent: 0 };
      x.clicks = (x.clicks ?? 0) + Number(t.clicks);
      detail.set(label, x);
    }
  }
  const order = ["ad", "post", "instagram", "whatsapp", "x", "facebook", "invoice", "website", "waitlist", "direct", "none"];
  return {
    data: {
      rows: [...by.values()].sort((a, b) => order.indexOf(a.source) - order.indexOf(b.source)),
      detail: [...detail.values()].sort((a, b) => b.signedUp - a.signedUp || (b.clicks ?? 0) - (a.clicks ?? 0)).slice(0, 10),
    },
    error: null,
  };
}

/* -------------------------------------------------------------------------- */
/* Whether people stay (API migration 0063, 3 November 2026)                  */
/* -------------------------------------------------------------------------- */

/** One Monday-to-Sunday week: businesses that sent a document, and setups finished. */
export type Week = { week: string; active: number; documents: number; new_users: number };

/** Businesses that sent a document: the last 7 days, the 7 before, and 30. */
export type Active = { active_7d: number; active_prev_7d: number; active_30d: number };

/**
 * People who finished setup in one week, and how many sent a document in
 * their week 0 (first seven days), 1, 2, 3, 4, 6 and 8. A week at or past
 * `weeks_complete` is still filling in.
 */
export type Cohort = {
  week: string;
  users: number;
  weeks_complete: number;
  w0: number;
  w1: number;
  w2: number;
  w3: number;
  w4: number;
  w6: number;
  w8: number;
};

/** How fast people get going. Each share is out of those who have had the time. */
export type Activation = {
  median_minutes_to_setup: number | null;
  median_minutes_to_first_doc: number | null;
  median_hours_to_first_paid: number | null;
  set_up_1d: number;
  first_doc_1d: number;
  set_up_7d: number;
  first_doc_7d: number;
  set_up_30d: number;
  first_paid_30d: number;
  never_sent: number;
};

/** Clients who opened an invoice, tapped "Made with Balans", and signed up. */
export type InvoiceLoop = { opened_30d: number; opened_total: number; taps: number; messaged: number; finished: number };

export async function loadWeekly(): Promise<Loaded<Week[]>> {
  const { data, error } = await serviceClient().from("admin_weekly").select("*").order("week");
  if (error || !data) return { data: null, error: error?.message ?? "no rows" };
  return { data: data.map((r) => numeric<Week>(r, ["week"])), error: null };
}

export async function loadActive(): Promise<Loaded<Active>> {
  const { data, error } = await serviceClient().from("admin_active").select("*").single();
  if (error || !data) return { data: null, error: error?.message ?? "no row" };
  return { data: numeric<Active>(data, []), error: null };
}

export async function loadCohorts(): Promise<Loaded<Cohort[]>> {
  const { data, error } = await serviceClient().from("admin_cohorts").select("*").order("week", { ascending: false });
  if (error || !data) return { data: null, error: error?.message ?? "no rows" };
  return { data: data.map((r) => numeric<Cohort>(r, ["week"])), error: null };
}

export async function loadActivation(): Promise<Loaded<Activation>> {
  const { data, error } = await serviceClient().from("admin_activation").select("*").single();
  if (error || !data) return { data: null, error: error?.message ?? "no row" };
  // The medians stay null when nobody has got there yet, rather than reading 0.
  const medians = ["median_minutes_to_setup", "median_minutes_to_first_doc", "median_hours_to_first_paid"];
  const out = numeric<Activation>(data, medians);
  for (const k of medians) {
    const v = (data as Record<string, unknown>)[k];
    (out as Record<string, unknown>)[k] = v === null || v === undefined ? null : Number(v);
  }
  return { data: out, error: null };
}

export async function loadInvoiceLoop(): Promise<Loaded<InvoiceLoop>> {
  const { data, error } = await serviceClient().from("admin_invoice_loop").select("*").single();
  if (error || !data) return { data: null, error: error?.message ?? "no row" };
  return { data: numeric<InvoiceLoop>(data, []), error: null };
}

/**
 * Of the people who have lived through their second week (week 1), the share
 * who sent a document in it. The earliest retention figure that means
 * anything, so the Overview can show it before a month has passed.
 */
export function cameBack(cohorts: Cohort[]): { pct: number | null; of: number } {
  const ready = cohorts.filter((c) => c.weeks_complete > 1);
  const of = ready.reduce((a, c) => a + c.users, 0);
  const back = ready.reduce((a, c) => a + c.w1, 0);
  return { pct: of > 0 ? (100 * back) / of : null, of };
}
