import Link from "next/link";
import { serviceClient } from "@/lib/supabase";
import { naira, shortDate } from "@/lib/money";
import {
  loadAccounts,
  loadDaily,
  loadInsights,
  loadOverview,
  loadPayments,
  type Day,
  type Insights,
  type Overview,
} from "@/lib/dashboard";
import {
  AreaChart,
  Delta,
  Donut,
  DualBars,
  Funnel,
  Gauge,
  HourStrip,
  RankedBars,
  Sparkline,
  weekChange,
} from "@/components/charts";
import { MetricsPanel, type Metrics } from "./metrics";
import { Failed, gate, Shell } from "./shell";

export const dynamic = "force-dynamic";

/*
 * The whole business on one page.
 *
 * Every figure is defined once, in the admin_* views in the API's migrations
 * (0027, 0028); this page only lays them out. It reads top to bottom in the
 * order the questions come: how is it going, where is the money, who is
 * using it and how, and what needs looking at.
 */
export default async function OverviewPage() {
  const g = await gate();
  if (!g.staff) return g.stop;

  const [overview, daily, insights, top, recent, health] = await Promise.all([
    loadOverview(),
    loadDaily(),
    loadInsights(),
    loadAccounts("", "invoiced"),
    loadPayments("success"),
    loadHealth(),
  ]);

  /*
   * Two different questions, both answered. `pro_users` counts subscriptions
   * somebody has paid for, which is what MRR is made of; the plan on the
   * account is what unlocks Pro, and an account can be on it without paying
   * (set by hand, or comped). Showing one as "Pro" left the users list and
   * the MRR figure looking like they disagreed.
   */
  const onPro = top.data ? top.data.filter((a) => a.plan === "pro").length : null;

  const now = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Lagos",
  }).format(new Date());

  return (
    <Shell email={g.staff.email} current="/" title="Overview" sub={`Live from the database · ${now} Lagos`}>
      {overview.error || !daily.data ? (
        <Failed what="the overview" error={overview.error ?? daily.error ?? "unknown"} />
      ) : (
        <>
          <Hero o={overview.data!} days={daily.data} onPro={onPro} />
          <RightNow o={overview.data!} />
          <MoneySection o={overview.data!} days={daily.data} i={insights.data} />
          <GrowthSection o={overview.data!} days={daily.data} i={insights.data} onPro={onPro} />
          {insights.data ? <UsageSection o={overview.data!} i={insights.data} /> : <Failed what="insights" error={insights.error ?? ""} />}
        </>
      )}

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <Panel title="Top users" action={<More href="/users">All users</More>}>
          {top.data ? (
            <List
              rows={top.data.slice(0, 7).map((a, idx) => ({
                key: a.id,
                rank: idx + 1,
                left: a.business_name ?? `+${a.wa_phone}`,
                sub: `${a.invoices} invoice${a.invoices === 1 ? "" : "s"} · ${a.plan === "pro" ? "Pro" : "Free"}`,
                right: naira(a.invoiced_kobo),
                rightSub: `${naira(a.collected_kobo)} paid`,
              }))}
              empty="Nobody has sent an invoice yet."
            />
          ) : (
            <Failed what="users" error={top.error} />
          )}
        </Panel>
        <Panel title="Latest payments" action={<More href="/payments">All payments</More>}>
          {recent.data ? (
            <List
              rows={recent.data.slice(0, 7).map((p) => ({
                key: p.id,
                left: p.business_name ?? "—",
                sub: `${p.client_name ?? "—"} · ${p.provider === "paystack" ? "Card" : "Transfer"} · ${shortDate(p.at)}`,
                right: naira(p.client_total_kobo),
                rightSub: p.document_ref ?? "",
              }))}
              empty="No payments yet."
            />
          ) : (
            <Failed what="payments" error={recent.error} />
          )}
        </Panel>
      </div>

      <MetricsPanel m={health} />
    </Shell>
  );
}

/* -------------------------------------------------------------------------- */
/* Hero                                                                       */
/* -------------------------------------------------------------------------- */

function Hero({ o, days, onPro }: { o: Overview; days: Day[]; onPro: number | null }) {
  const collected = days.map((d) => d.collected_kobo);
  const signups = days.map((d) => d.signups);
  const docs = days.map((d) => d.documents);

  const tiles = [
    {
      label: "MRR",
      value: naira(o.mrr_kobo),
      note: `${o.pro_users} paying${onPro !== null && onPro !== o.pro_users ? ` · ${onPro} on Pro` : ""} · ${naira(o.mrr_kobo * 12)} a year`,
      spark: null as number[] | null,
      delta: undefined as number | null | undefined,
    },
    {
      label: "Collected, 30 days",
      value: naira(o.collected_30d_kobo),
      note: `${naira(o.collected_kobo)} all time`,
      spark: collected,
      delta: weekChange(collected),
    },
    {
      label: "Users",
      value: o.users_total.toLocaleString("en-NG"),
      note: `${o.signups_24h} joined in 24 hours`,
      spark: signups,
      delta: weekChange(signups),
    },
    {
      label: "Documents, 30 days",
      value: o.documents_30d.toLocaleString("en-NG"),
      note: `${o.documents_total.toLocaleString("en-NG")} all time`,
      spark: docs,
      delta: weekChange(docs),
    },
  ];

  return (
    <section className="relative overflow-hidden rounded-[28px] bg-ink p-6 text-cream sm:p-8">
      <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-marigold/20 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-32 left-1/3 size-72 rounded-full bg-moss/25 blur-3xl" />
      <div className="relative grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="min-w-0">
            <p className="text-[0.7rem] font-semibold tracking-widest text-cream/55 uppercase">{t.label}</p>
            <p className="mt-2 font-display text-[2.1rem] leading-none font-extrabold tracking-tight tabular-nums">{t.value}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {t.delta !== undefined && <Delta pct={t.delta} dark />}
              <span className="text-xs text-cream/50">{t.note}</span>
            </div>
            {t.spark && <Sparkline values={t.spark} className="mt-3 h-10 w-full text-marigold" />}
          </div>
        ))}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Right now                                                                  */
/* -------------------------------------------------------------------------- */

function RightNow({ o }: { o: Overview }) {
  const windows = [
    { k: "6h", s: o.signups_6h, d: o.documents_6h },
    { k: "12h", s: o.signups_12h, d: o.documents_12h },
    { k: "24h", s: o.signups_24h, d: o.documents_24h },
    { k: "7 days", s: o.signups_7d, d: o.documents_7d },
    { k: "30 days", s: o.signups_30d, d: o.documents_30d },
  ];
  return (
    <section className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {windows.map((w) => (
        <div key={w.k} className="rounded-[20px] bg-white px-5 py-4 ring-1 ring-ink/10 ring-inset">
          <p className="text-[0.7rem] font-semibold tracking-[0.08em] text-ink/45 uppercase">Last {w.k}</p>
          <div className="mt-2 flex items-end justify-between gap-2">
            <div>
              <p className="font-display text-2xl font-extrabold tabular-nums">{w.s}</p>
              <p className="text-xs text-ink/50">sign-ups</p>
            </div>
            <div className="text-right">
              <p className="font-display text-2xl font-extrabold tabular-nums text-ink/70">{w.d}</p>
              <p className="text-xs text-ink/50">documents</p>
            </div>
          </div>
        </div>
      ))}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Money                                                                      */
/* -------------------------------------------------------------------------- */

function MoneySection({ o, days, i }: { o: Overview; days: Day[]; i: Insights | null }) {
  const paymentRate =
    o.invoices_paid + o.invoices_unpaid > 0 ? (100 * o.invoices_paid) / (o.invoices_paid + o.invoices_unpaid) : null;
  const contribution = o.earned_30d_kobo - o.message_cost_30d_kobo;

  return (
    <>
      <Heading title="Money" sub="What clients paid, what is still owed, and what Balans keeps." />
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel
          className="lg:col-span-2"
          title="Collected per day"
          action={<span className="font-display text-lg font-bold tabular-nums">{naira(o.collected_30d_kobo)}</span>}
        >
          <AreaChart
            id="collected"
            points={days.map((d) => ({ label: shortDate(d.day), value: d.collected_kobo }))}
            format={(v) => compactNaira(v)}
          />
          <div className="mt-3 flex justify-between text-[0.68rem] text-ink/40">
            <span>{shortDate(days[0]!.day)}</span>
            <span>Today</span>
          </div>
        </Panel>
        <Panel title="Invoices paid">
          <Gauge pct={paymentRate} target={70} label="Of invoices sent" />
          <div className="mt-5 grid grid-cols-3 gap-2 text-center">
            <Mini label="Paid" value={o.invoices_paid} tone="moss" />
            <Mini label="Unpaid" value={o.invoices_unpaid} />
            <Mini label="Overdue" value={o.invoices_overdue} tone={o.invoices_overdue ? "clay" : undefined} />
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Invoiced, all time" value={naira(o.invoiced_kobo)} note={`${naira(o.invoiced_30d_kobo)} in 30 days`} />
        <Stat label="Unpaid by clients" value={naira(o.outstanding_kobo)} note={`${o.invoices_unpaid} invoices waiting`} tone={o.outstanding_kobo > 0 ? "clay" : undefined} />
        <Stat
          label="Average invoice"
          value={naira(i?.avg_invoice_kobo ?? 0)}
          note={i ? `Median ${naira(i.median_invoice_kobo)} · largest ${naira(i.largest_invoice_kobo)}` : undefined}
        />
        <Stat
          label="Time to get paid"
          value={i?.median_hours_to_paid == null ? "—" : formatHours(i.median_hours_to_paid)}
          note="Median, from sent to paid"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel title="What Balans earns">
          <dl className="space-y-3 text-sm">
            <Row k="Subscriptions" v={naira(o.earned_subscriptions_kobo)} />
            <Row k="Transaction fees" v={naira(o.earned_fees_kobo)} />
            <Row k="Earned, 30 days" v={naira(o.earned_30d_kobo)} strong />
            <Row k="WhatsApp, 30 days" v={`−${naira(o.message_cost_30d_kobo)}`} muted />
            <div className="border-t border-ink/10 pt-3">
              <Row k="Left after WhatsApp" v={naira(contribution)} strong tone={contribution < 0 ? "clay" : "moss"} />
            </div>
          </dl>
        </Panel>
        <Panel title="How clients pay">
          <Donut
            center={String((i?.payments_by_card ?? 0) + (i?.payments_by_transfer ?? 0))}
            sub="payments"
            slices={[
              { label: "Bank transfer", value: i?.payments_by_transfer ?? 0, color: "#10231c" },
              { label: "Card", value: i?.payments_by_card ?? 0, color: "#f5b82e" },
            ]}
          />
          <p className="mt-4 text-xs text-ink/50">
            {naira(i?.collected_by_transfer_kobo ?? 0)} by transfer · {naira(o.collected_by_card_kobo)} by card ·{" "}
            {naira(o.processor_fees_kobo)} to processors
          </p>
        </Panel>
        <Panel title="Currencies">
          <Donut
            center={String(o.documents_total)}
            sub="documents"
            slices={(i?.documents_by_currency ?? []).map((s, idx) => ({
              label: String(s.k),
              value: s.n,
              color: ["#10231c", "#f5b82e", "#3f8f5f", "#c2462e"][idx % 4],
            }))}
          />
        </Panel>
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Growth                                                                     */
/* -------------------------------------------------------------------------- */

function GrowthSection({ o, days, i, onPro }: { o: Overview; days: Day[]; i: Insights | null; onPro: number | null }) {
  const conversion = o.users_active_30d > 0 ? (100 * o.pro_users) / o.users_active_30d : null;
  return (
    <>
      <Heading title="Growth" sub="Who is joining, and how far they get." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Sign-ups and documents per day">
          <DualBars
            labels={days.map((d) => shortDate(d.day))}
            a={{ name: "Sign-ups", values: days.map((d) => d.signups) }}
            b={{ name: "Documents", values: days.map((d) => d.documents) }}
          />
        </Panel>
        <Panel title="From sign-up to paying">
          {i ? (
            <>
              <Funnel
                steps={[
                  { label: "Signed up", value: i.funnel_signed_up },
                  { label: "Email verified", value: i.funnel_email_verified },
                  { label: "Finished setup", value: i.funnel_set_up },
                  { label: "Sent a document", value: i.funnel_first_document },
                  { label: "Got paid", value: i.funnel_first_paid },
                  { label: "Paid for Pro", value: i.funnel_ever_pro },
                ]}
              />
              {i.median_minutes_to_first_document !== null && (
                <p className="mt-4 text-xs text-ink/50">
                  Median time from sign-up to first document:{" "}
                  <strong className="font-semibold text-ink">{formatMinutes(i.median_minutes_to_first_document)}</strong>
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-ink/45">Insights not available yet.</p>
          )}
        </Panel>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Finished setup" value={String(o.users_onboarded)} note={`of ${o.users_total} who signed up`} />
        <Stat label="Active, 30 days" value={String(o.users_active_30d)} note="Sent at least one document" />
        <Stat
          label="On Pro"
          value={String(onPro ?? o.pro_users)}
          note={`${o.pro_users} paying${conversion === null ? "" : ` · ${conversion.toFixed(1)}% of active users`}`}
        />
        <Stat label="Waitlist" value={o.waitlist_total.toLocaleString("en-NG")} note="Still waiting to be let in" />
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Usage                                                                      */
/* -------------------------------------------------------------------------- */

function UsageSection({ o, i }: { o: Overview; i: Insights }) {
  const hours = Array.from({ length: 24 }, (_, h) => i.documents_by_hour.find((s) => Number(s.k) === h)?.n ?? 0);
  const statusName: Record<string, string> = {
    sent: "Sent",
    viewed: "Opened",
    overdue: "Overdue",
    part_paid: "Part paid",
    paid: "Paid",
    cancelled: "Cancelled",
    accepted: "Accepted",
    converted: "Converted",
    expired: "Expired",
  };
  return (
    <>
      <Heading title="Usage" sub="How people use it, and what the bot does for them." />
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Where documents stand">
          <Donut
            center={String(o.documents_total)}
            sub="documents"
            slices={i.documents_by_status.map((s) => ({
              label: statusName[String(s.k)] ?? String(s.k),
              value: s.n,
              color:
                s.k === "paid"
                  ? "#3f8f5f"
                  : s.k === "overdue"
                    ? "#c2462e"
                    : s.k === "viewed"
                      ? "#f5b82e"
                      : s.k === "part_paid"
                        ? "#d99a12"
                        : s.k === "sent"
                          ? "#10231c"
                          : "#8aa399",
            }))}
          />
        </Panel>
        <Panel title="When invoices go out">
          <HourStrip counts={hours} />
          <div className="mt-5 grid grid-cols-3 gap-2 text-center">
            <Mini label="Invoices" value={o.invoices_total} />
            <Mini label="Quotes" value={o.quotes_total} />
            <Mini label="Requests" value={o.requests_total} />
          </div>
        </Panel>
        <Panel title="Talking to the bot, 30 days">
          <dl className="space-y-3 text-sm">
            <Row k="Messages from users" v={i.messages_in_30d.toLocaleString("en-NG")} />
            <Row k="Messages sent" v={i.messages_out_30d.toLocaleString("en-NG")} />
            <Row k="Of which templates" v={i.templates_out_30d.toLocaleString("en-NG")} muted />
            <Row k="Users messaging, 24h / 7d / 30d" v={`${i.users_messaging_24h} / ${i.users_messaging_7d} / ${i.users_messaging_30d}`} />
            <Row k="Sentences read by the parser" v={i.parses_30d.toLocaleString("en-NG")} />
            <Row k="Parser, average" v={i.parser_avg_ms === null ? "—" : `${(i.parser_avg_ms / 1000).toFixed(1)}s`} muted />
          </dl>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel title="Designs chosen">
          <RankedBars items={i.designs.map((s) => ({ label: titleCase(String(s.k)), value: s.n }))} />
        </Panel>
        <Panel title="Where the waitlist came from">
          <RankedBars items={i.waitlist_sources.map((s) => ({ label: titleCase(String(s.k)), value: s.n }))} color="#f5b82e" />
        </Panel>
        <Panel title="What the bot sent, 30 days">
          <RankedBars
            items={i.messages_by_kind_30d.slice(0, 8).map((s) => ({ label: titleCase(String(s.k)), value: s.n }))}
            color="#3f8f5f"
          />
        </Panel>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Clients on file"
          value={i.clients_total.toLocaleString("en-NG")}
          note={`${i.clients_with_email} with email · ${i.clients_with_phone} with WhatsApp`}
        />
        <Stat
          label="Reminders, 30 days"
          value={String(i.reminders_sent_30d)}
          note={`${i.reminders_pending} waiting · ${i.reminders_failed} failed`}
          tone={i.reminders_failed ? "clay" : undefined}
        />
        <Stat label="Receipts issued" value={String(i.receipts_issued)} note={`${i.payments_troubled} payments need a look`} tone={i.payments_troubled ? "clay" : undefined} />
        <Stat
          label="Referrals"
          value={String(i.referrals_total)}
          note={`${i.referrals_credited} credited · ${i.risk_flags_open} risk flags open`}
          tone={i.risk_flags_open ? "clay" : undefined}
        />
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Pieces                                                                     */
/* -------------------------------------------------------------------------- */

function Heading({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mt-10 mb-4">
      <h2 className="font-display text-xl font-bold tracking-tight">{title}</h2>
      <p className="mt-0.5 text-sm text-ink/50">{sub}</p>
    </div>
  );
}

function Panel({
  title,
  action,
  className = "",
  children,
}: {
  title: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`rounded-3xl bg-white p-5 ring-1 ring-ink/10 ring-inset sm:p-6 ${className}`}>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h3 className="text-[0.72rem] font-semibold tracking-[0.08em] text-ink/50 uppercase">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: "clay" }) {
  return (
    <div className="rounded-[20px] bg-white px-5 py-4 ring-1 ring-ink/10 ring-inset">
      <p className="text-[0.7rem] font-semibold tracking-[0.08em] text-ink/45 uppercase">{label}</p>
      <p className={`mt-1 font-display text-2xl font-extrabold tracking-tight tabular-nums ${tone === "clay" ? "text-clay" : ""}`}>
        {value}
      </p>
      {note && <p className="mt-1 text-xs leading-relaxed text-ink/50">{note}</p>}
    </div>
  );
}

function Mini({ label, value, tone }: { label: string; value: number; tone?: "moss" | "clay" }) {
  return (
    <div className="rounded-2xl bg-cream px-2 py-2.5">
      <p className={`font-display text-xl font-extrabold tabular-nums ${tone === "moss" ? "text-moss" : tone === "clay" ? "text-clay" : ""}`}>
        {value}
      </p>
      <p className="text-[0.68rem] text-ink/50">{label}</p>
    </div>
  );
}

function Row({ k, v, strong, muted, tone }: { k: string; v: string; strong?: boolean; muted?: boolean; tone?: "clay" | "moss" }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={muted ? "text-ink/45" : "text-ink/70"}>{k}</dt>
      <dd
        className={`tabular-nums ${strong ? "font-display text-base font-bold" : ""} ${
          tone === "clay" ? "text-clay" : tone === "moss" ? "text-moss" : muted ? "text-ink/45" : ""
        }`}
      >
        {v}
      </dd>
    </div>
  );
}

function More({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-sm font-semibold text-ink/55 hover:text-ink">
      {children} →
    </Link>
  );
}

function List({
  rows,
  empty,
}: {
  rows: { key: string; rank?: number; left: string; sub: string; right: string; rightSub: string }[];
  empty: string;
}) {
  if (!rows.length) return <p className="text-sm text-ink/45">{empty}</p>;
  return (
    <ul className="-my-2 divide-y divide-ink/8">
      {rows.map((r) => (
        <li key={r.key} className="flex items-center justify-between gap-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            {r.rank !== undefined && (
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-cream text-xs font-bold">{r.rank}</span>
            )}
            <div className="min-w-0">
              <p className="truncate font-semibold">{r.left}</p>
              <p className="truncate text-xs text-ink/50">{r.sub}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-display font-bold tabular-nums">{r.right}</p>
            <p className="text-xs text-ink/50">{r.rightSub}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

/* -------------------------------------------------------------------------- */
/* Formatting                                                                 */
/* -------------------------------------------------------------------------- */

/** ₦1.2m, ₦350k, ₦900 — for axes, where the full figure would not fit. */
function compactNaira(kobo: number): string {
  const v = kobo / 100;
  if (v >= 1_000_000) return `₦${(v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1)}m`;
  if (v >= 1_000) return `₦${Math.round(v / 1_000)}k`;
  return `₦${Math.round(v)}`;
}

function formatHours(h: number): string {
  if (h < 1) return `${Math.round(h * 60)} min`;
  if (h < 48) return `${h.toFixed(h < 10 ? 1 : 0)} h`;
  return `${(h / 24).toFixed(1)} days`;
}

function formatMinutes(m: number): string {
  if (m < 60) return `${m} min`;
  if (m < 60 * 48) return `${(m / 60).toFixed(1)} hours`;
  return `${(m / 1440).toFixed(1)} days`;
}

const titleCase = (s: string) => s.replace(/[_-]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());

/**
 * The older 30-day health panel, from `admin_metrics`. Kept because its
 * figures carry targets. Null when the view is not there, and the panel says
 * so rather than failing the page.
 */
async function loadHealth(): Promise<Metrics | null> {
  try {
    const { data, error } = await serviceClient().from("admin_metrics").select("*").single();
    if (error) return null;
    return data as Metrics;
  } catch {
    return null;
  }
}
