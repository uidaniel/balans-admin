import { serviceClient } from "@/lib/supabase";
import { naira, shortDate } from "@/lib/money";
import { loadUnverifiedSubaccounts, PAYSTACK_SUBACCOUNTS_URL,
  loadAccounts,
  loadDaily,
  loadInsights,
  loadOverview,
  loadPayments,
  loadWhatsApp,
  type Account,
  type Day,
  type Insights,
  type Overview,
  type Payment,
  type WhatsApp,
} from "@/lib/dashboard";
import {
  ColumnChart,
  Donut,
  DualBars,
  Funnel,
  Gauge,
  HourStrip,
  MiniBars,
  RankedBars,
  weekChange,
} from "@/components/charts";
import { Avatar, Card, Empty, Kpi, MoreLink, Notice, Pill, SectionTitle, Stat, btn, statGrid, table } from "@/components/ui";
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

  const [overview, daily, insights, top, recent, health, whatsapp] = await Promise.all([
    loadOverview(),
    loadDaily(),
    loadInsights(),
    loadAccounts("", "invoiced"),
    loadPayments("success"),
    loadHealth(),
    loadWhatsApp(),
  ]);
  const unverified = await loadUnverifiedSubaccounts();
  const waiting = unverified.data ?? [];

  /*
   * Two different questions, both answered. `pro_users` counts subscriptions
   * somebody has paid for, which is what MRR is made of; the plan on the
   * account is what unlocks Pro, and an account can be on it without paying
   * (set by hand, or comped). Showing one as "Pro" left the users list and
   * the MRR figure looking like they disagreed.
   */
  const onPro = top.data ? top.data.filter((a) => a.plan === "pro").length : null;

  return (
    <Shell
      email={g.staff.email}
      current="/"
      title="Overview"
      sub="How it is going, where the money is, who is using it, and what needs a look."
    >
      {waiting.length > 0 && (
        <Notice
          tone="clay"
          className="mb-4"
          title={`${waiting.length} Paystack subaccount${waiting.length === 1 ? "" : "s"} to verify`}
          action={
            <a href={PAYSTACK_SUBACCOUNTS_URL} target="_blank" rel="noopener noreferrer" className={`${btn.primary} ml-7 sm:ml-0`}>
              Open Paystack
            </a>
          }
        >
          Paystack holds card payments to these until they are verified:{" "}
          <strong className="font-medium text-ink">{waiting.map((w) => w.business ?? "Unnamed").join(", ")}</strong>. Tick
          each one on Paystack&apos;s Subaccounts page and press Verify subaccounts. This clears within the hour after.
        </Notice>
      )}
      {overview.error || !daily.data ? (
        <Failed what="the overview" error={overview.error ?? daily.error ?? "unknown"} />
      ) : (
        <>
          <Headline o={overview.data!} days={daily.data} onPro={onPro} />
          <div className="mt-4 grid gap-4 xl:grid-cols-3">
            <Card
              className="xl:col-span-2"
              title="Collected per day"
              sub="What clients paid through Balans, last 30 days"
              action={
                <div className="shrink-0 text-right">
                  <p className="font-display text-[1.35rem] leading-tight font-light tracking-[-0.025em] tabular-nums">
                    {naira(overview.data!.collected_30d_kobo)}
                  </p>
                  <p className="mt-0.5 text-xs text-ink/45">{naira(overview.data!.collected_24h_kobo)} in 24 hours</p>
                </div>
              }
            >
              <ColumnChart
                points={daily.data.map((d) => ({ label: dayMonth(d.day), value: d.collected_kobo }))}
                format={(v) => compactNaira(v)}
              />
            </Card>
            <InvoicesPaid o={overview.data!} />
          </div>
          <RightNow o={overview.data!} />
          <MoneySection o={overview.data!} i={insights.data} w={whatsapp.data} />
          <GrowthSection o={overview.data!} days={daily.data} i={insights.data} onPro={onPro} />
          {insights.data ? (
            <UsageSection o={overview.data!} i={insights.data} />
          ) : (
            <div className="mt-12">
              <Failed what="insights" error={insights.error ?? ""} />
            </div>
          )}
        </>
      )}

      <SectionTitle title="People and payments" sub="Who bills the most, and the money that came in last." />
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Top users" sub="By amount invoiced" flush action={<MoreLink href="/users">All users</MoreLink>}>
          {top.data ? (
            <TopUsers rows={top.data.slice(0, 7)} />
          ) : (
            <div className="p-4 sm:p-5">
              <Failed what="users" error={top.error} />
            </div>
          )}
        </Card>
        <Card
          title="Latest payments"
          sub="Successful, newest first"
          flush
          action={<MoreLink href="/payments">All payments</MoreLink>}
        >
          {recent.data ? (
            <LatestPayments rows={recent.data.slice(0, 7)} />
          ) : (
            <div className="p-4 sm:p-5">
              <Failed what="payments" error={recent.error} />
            </div>
          )}
        </Card>
      </div>

      <MetricsPanel m={health} whatsapp={whatsapp.data} />
    </Shell>
  );
}

/* -------------------------------------------------------------------------- */
/* Headline                                                                   */
/* -------------------------------------------------------------------------- */

function Headline({ o, days, onPro }: { o: Overview; days: Day[]; onPro: number | null }) {
  const collected = days.map((d) => d.collected_kobo);
  const signups = days.map((d) => d.signups);
  const docs = days.map((d) => d.documents);

  return (
    <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      <Kpi
        dark
        className="col-span-2 sm:col-span-1"
        label="Monthly recurring revenue" icon="trending" value={naira(o.mrr_kobo)} note={`${naira(o.mrr_kobo * 12)} a year`}>
        <div className="flex flex-wrap items-center gap-2 text-xs text-cream/60">
          <span className="rounded-full bg-marigold/15 px-2.5 py-1 font-medium text-marigold ring-1 ring-marigold/25 ring-inset">
            {o.pro_users} paying
          </span>
          {onPro !== null && onPro !== o.pro_users && <span>{onPro} on Pro</span>}
        </div>
      </Kpi>
      <Kpi
        className="col-span-2 sm:col-span-1"
        label="Collected, 30 days"
        icon="wallet"
        value={naira(o.collected_30d_kobo)}
        note={`${naira(o.collected_kobo)} all time`}
        delta={weekChange(collected)}
      >
        <MiniBars values={collected} />
      </Kpi>
      <Kpi
        label="Users"
        icon="users"
        value={o.users_total.toLocaleString("en-NG")}
        note={`${o.signups_24h} joined in the last 24 hours`}
        delta={weekChange(signups)}
      >
        <MiniBars values={signups} />
      </Kpi>
      <Kpi
        label="Documents, 30 days"
        icon="file"
        value={o.documents_30d.toLocaleString("en-NG")}
        note={`${o.documents_total.toLocaleString("en-NG")} all time`}
        delta={weekChange(docs)}
      >
        <MiniBars values={docs} />
      </Kpi>
    </section>
  );
}

function InvoicesPaid({ o }: { o: Overview }) {
  const paymentRate =
    o.invoices_paid + o.invoices_unpaid > 0 ? (100 * o.invoices_paid) / (o.invoices_paid + o.invoices_unpaid) : null;
  return (
    <Card title="Invoices paid" sub="Of every invoice sent">
      <Gauge pct={paymentRate} target={70} label="paid" />
      <div className="mt-5 grid grid-cols-3 divide-x divide-line rounded-2xl border border-line bg-paper">
        <Mini label="Paid" value={o.invoices_paid} tone="moss" />
        <Mini label="Unpaid" value={o.invoices_unpaid} />
        <Mini label="Overdue" value={o.invoices_overdue} tone={o.invoices_overdue ? "clay" : undefined} />
      </div>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Right now                                                                  */
/* -------------------------------------------------------------------------- */

function RightNow({ o }: { o: Overview }) {
  const windows = [
    { k: "6 hours", s: o.signups_6h, d: o.documents_6h },
    { k: "12 hours", s: o.signups_12h, d: o.documents_12h },
    { k: "24 hours", s: o.signups_24h, d: o.documents_24h },
    { k: "7 days", s: o.signups_7d, d: o.documents_7d },
    { k: "30 days", s: o.signups_30d, d: o.documents_30d },
  ];
  return (
    <Card className="mt-4" title="Right now" sub="Sign-ups and documents, by window">
      <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 lg:grid-cols-5 lg:divide-x lg:divide-line">
        {windows.map((w) => (
          <div key={w.k} className="min-w-0 lg:px-5 lg:first:pl-0 lg:last:pr-0">
            <p className="text-xs font-medium text-ink/45">Last {w.k}</p>
            <div className="mt-2 flex items-baseline gap-4 sm:gap-5">
              <div>
                <p className="font-display text-[1.6rem] leading-tight font-light tracking-[-0.03em] tabular-nums">{w.s}</p>
                <p className="text-xs text-ink/50">sign-ups</p>
              </div>
              <div>
                <p className="font-display text-[1.6rem] leading-tight font-light tracking-[-0.03em] text-ink/40 tabular-nums">{w.d}</p>
                <p className="text-xs text-ink/50">documents</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Money                                                                      */
/* -------------------------------------------------------------------------- */

function MoneySection({ o, i, w }: { o: Overview; i: Insights | null; w: WhatsApp | null }) {
  /*
   * What WhatsApp cost, as Meta charged it (admin_whatsapp), not the old
   * per-message guess in `message_cost_30d_kobo`. Until Meta has reported
   * anything there is no figure to take away, so "left after" waits too.
   */
  const spend = w?.spend_30d_kobo ?? null;
  const contribution = spend === null ? null : o.earned_30d_kobo - spend;

  return (
    <>
      <SectionTitle title="Money" sub="What clients paid, what is still owed, and what Balans keeps." />
      <div className={statGrid}>
        <Stat icon="file" label="Invoiced, all time" value={naira(o.invoiced_kobo)} note={`${naira(o.invoiced_30d_kobo)} in 30 days`} />
        <Stat
          icon="alert"
          label="Unpaid by clients"
          value={naira(o.outstanding_kobo)}
          note={`${o.invoices_unpaid} invoices waiting`}
          tone={o.outstanding_kobo > 0 ? "clay" : undefined}
        />
        <Stat
          icon="receipt"
          label="Average invoice"
          value={naira(i?.avg_invoice_kobo ?? 0)}
          note={i ? `Median ${naira(i.median_invoice_kobo)} · largest ${naira(i.largest_invoice_kobo)}` : undefined}
        />
        <Stat
          icon="clock"
          label="Time to get paid"
          value={i?.median_hours_to_paid == null ? "—" : formatHours(i.median_hours_to_paid)}
          note="Median, from sent to paid"
        />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        <Card title="What Balans earns" sub="Revenue, and the cost of sending it">
          <dl className="space-y-3.5 text-sm">
            <Row k="Subscriptions" v={naira(o.earned_subscriptions_kobo)} />
            <Row k="Transaction fees" v={naira(o.earned_fees_kobo)} />
            <Row k="Earned, 30 days" v={naira(o.earned_30d_kobo)} strong />
            <Row k="WhatsApp, 30 days" v={spend === null ? "Not reported yet" : `−${naira(spend)}`} muted />
          </dl>
          <div
            className={`mt-5 flex items-center justify-between gap-3 rounded-2xl px-4 py-3.5 ${
              contribution === null ? "bg-ink/[0.04]" : contribution < 0 ? "bg-clay/[0.07]" : "bg-moss/[0.08]"
            }`}
          >
            <span className="text-sm font-medium text-ink/70">Left after WhatsApp</span>
            <span
              className={`font-display text-[1.25rem] font-normal tracking-[-0.02em] tabular-nums ${
                contribution === null ? "text-ink/40" : contribution < 0 ? "text-clay" : "text-moss"
              }`}
            >
              {contribution === null ? "—" : naira(contribution)}
            </span>
          </div>
          {w?.spend_reported_through && (
            <p className="mt-3 text-xs text-ink/45">WhatsApp as Meta charged it, through {shortDate(w.spend_reported_through)}.</p>
          )}
        </Card>
        <Card title="How clients pay" sub={`${naira(o.processor_fees_kobo)} to processors`}>
          <Donut
            center={String((i?.payments_by_card ?? 0) + (i?.payments_by_transfer ?? 0))}
            sub="payments"
            slices={[
              { label: "Bank transfer", value: i?.payments_by_transfer ?? 0, color: "#10231c" },
              { label: "Card", value: i?.payments_by_card ?? 0, color: "#f5b82e" },
            ]}
          />
          <p className="mt-4 border-t border-line pt-3 text-xs text-ink/50">
            {naira(i?.collected_by_transfer_kobo ?? 0)} by transfer · {naira(o.collected_by_card_kobo)} by card
          </p>
        </Card>
        <WhatsAppCard w={w} />
        <Card title="Currencies" sub="Documents by currency">
          <Donut
            center={String(o.documents_total)}
            sub="documents"
            slices={(i?.documents_by_currency ?? []).map((s, idx) => ({
              label: String(s.k),
              value: s.n,
              color: ["#10231c", "#f5b82e", "#3f8f5f", "#c2462e"][idx % 4],
            }))}
          />
        </Card>
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
      <SectionTitle title="Growth" sub="Who is joining, and how far they get." />
      <div className={statGrid}>
        <Stat icon="check" label="Finished setup" value={String(o.users_onboarded)} note={`of ${o.users_total} who signed up`} />
        <Stat icon="activity" label="Active, 30 days" value={String(o.users_active_30d)} note="Sent at least one document" />
        <Stat
          icon="zap"
          label="On Pro"
          value={String(onPro ?? o.pro_users)}
          note={`${o.pro_users} paying${conversion === null ? "" : ` · ${conversion.toFixed(1)}% of active users`}`}
        />
        <Stat icon="clock" label="Waitlist" value={o.waitlist_total.toLocaleString("en-NG")} note="Still waiting to be let in" />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Sign-ups and documents" sub="Per day, last 30 days">
          <DualBars
            labels={days.map((d) => dayMonth(d.day))}
            a={{ name: "Sign-ups", values: days.map((d) => d.signups) }}
            b={{ name: "Documents", values: days.map((d) => d.documents) }}
          />
        </Card>
        <Card title="From sign-up to paying" sub="Each step against the one before">
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
                <p className="mt-5 border-t border-line pt-3 text-xs text-ink/50">
                  Median time from sign-up to first document:{" "}
                  <strong className="font-medium text-ink">{formatMinutes(i.median_minutes_to_first_document)}</strong>
                </p>
              )}
            </>
          ) : (
            <Empty icon="filter">Insights not available yet.</Empty>
          )}
        </Card>
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Usage                                                                      */
/* -------------------------------------------------------------------------- */

const STATUS_NAME: Record<string, string> = {
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

const STATUS_COLOR: Record<string, string> = {
  paid: "#3f8f5f",
  overdue: "#c2462e",
  viewed: "#f5b82e",
  part_paid: "#d99a12",
  sent: "#10231c",
};

function UsageSection({ o, i }: { o: Overview; i: Insights }) {
  const hours = Array.from({ length: 24 }, (_, h) => i.documents_by_hour.find((s) => Number(s.k) === h)?.n ?? 0);
  return (
    <>
      <SectionTitle title="Usage" sub="How people use it, and what the bot does for them." />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Where documents stand" sub="By status">
          <Donut
            center={String(o.documents_total)}
            sub="documents"
            slices={i.documents_by_status.map((s) => ({
              label: STATUS_NAME[String(s.k)] ?? String(s.k),
              value: s.n,
              color: STATUS_COLOR[String(s.k)] ?? "#8aa399",
            }))}
          />
        </Card>
        <Card title="When invoices go out" sub="By hour of day">
          <HourStrip counts={hours} />
          <div className="mt-5 grid grid-cols-3 divide-x divide-line rounded-2xl border border-line bg-paper">
            <Mini label="Invoices" value={o.invoices_total} />
            <Mini label="Quotes" value={o.quotes_total} />
            <Mini label="Requests" value={o.requests_total} />
          </div>
        </Card>
        <Card title="Talking to the bot" sub="Last 30 days">
          <dl className="space-y-3.5 text-sm">
            <Row k="Messages from users" v={i.messages_in_30d.toLocaleString("en-NG")} />
            <Row k="Messages sent" v={i.messages_out_30d.toLocaleString("en-NG")} />
            <Row k="Of which templates" v={i.templates_out_30d.toLocaleString("en-NG")} muted />
            <Row k="Users messaging, 24h / 7d / 30d" v={`${i.users_messaging_24h} / ${i.users_messaging_7d} / ${i.users_messaging_30d}`} />
            <Row k="Sentences read by the parser" v={i.parses_30d.toLocaleString("en-NG")} />
            <Row k="Parser, average" v={i.parser_avg_ms === null ? "—" : `${(i.parser_avg_ms / 1000).toFixed(1)}s`} muted />
          </dl>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title="Designs chosen">
          <RankedBars items={i.designs.map((s) => ({ label: titleCase(String(s.k)), value: s.n }))} />
        </Card>
        <Card title="Where the waitlist came from">
          <RankedBars items={i.waitlist_sources.map((s) => ({ label: titleCase(String(s.k)), value: s.n }))} color="#f5b82e" />
        </Card>
        <Card title="What the bot sent" sub="Last 30 days">
          <RankedBars
            items={i.messages_by_kind_30d.slice(0, 8).map((s) => ({ label: titleCase(String(s.k)), value: s.n }))}
            color="#3f8f5f"
          />
        </Card>
      </div>

      <div className={`mt-4 ${statGrid}`}>
        <Stat
          icon="users"
          label="Clients on file"
          value={i.clients_total.toLocaleString("en-NG")}
          note={`${i.clients_with_email} with email · ${i.clients_with_phone} with WhatsApp`}
        />
        <Stat
          icon="mail"
          label="Reminders, 30 days"
          value={String(i.reminders_sent_30d)}
          note={`${i.reminders_pending} waiting · ${i.reminders_failed} failed`}
          tone={i.reminders_failed ? "clay" : undefined}
        />
        <Stat
          icon="receipt"
          label="Receipts issued"
          value={String(i.receipts_issued)}
          note={`${i.payments_troubled} payments need a look`}
          tone={i.payments_troubled ? "clay" : undefined}
        />
        <Stat
          icon="gift"
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
/* Tables                                                                     */
/* -------------------------------------------------------------------------- */

function TopUsers({ rows }: { rows: Account[] }) {
  if (!rows.length) return <Empty icon="users">Nobody has sent an invoice yet.</Empty>;
  return (
    <>
      {/* Phone: one compact row per user. */}
      <ul className={`${table.list} md:hidden`}>
        {rows.map((a) => {
          const name = a.business_name ?? `+${a.wa_phone}`;
          return (
            <li key={a.id} className={`${table.item} flex items-center gap-3`}>
              <Avatar name={name} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2">
                  <span className="truncate font-medium">{name}</span>
                  {a.plan === "pro" && (
                    <Pill tone="ink" dot={false}>
                      Pro
                    </Pill>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-ink/50">
                  {a.invoices} invoice{a.invoices === 1 ? "" : "s"}
                </p>
              </div>
              <div className="shrink-0 text-right tabular-nums">
                <p className="text-sm font-medium">{naira(a.invoiced_kobo)}</p>
                <p className="mt-0.5 text-xs text-ink/50">{naira(a.collected_kobo)} collected</p>
              </div>
            </li>
          );
        })}
      </ul>

      <div className={`${table.wrap} hidden md:block`}>
        <table className={`${table.table} min-w-[460px]`}>
          <thead className={table.head}>
            <tr>
              <th className={table.th}>Business</th>
              <th className={table.th}>Plan</th>
              <th className={`${table.th} text-right`}>Invoiced</th>
              <th className={`${table.th} text-right`}>Collected</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {rows.map((a) => {
              const name = a.business_name ?? `+${a.wa_phone}`;
              return (
                <tr key={a.id} className={table.row}>
                  <td className={`${table.td} w-full max-w-0`}>
                    <div className="flex items-center gap-3">
                      <Avatar name={name} />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{name}</p>
                        <p className="text-xs text-ink/50">
                          {a.invoices} invoice{a.invoices === 1 ? "" : "s"}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className={table.td}>
                    <Pill tone={a.plan === "pro" ? "ink" : "neutral"} dot={false}>
                      {a.plan === "pro" ? "Pro" : "Free"}
                    </Pill>
                  </td>
                  <td className={`${table.td} text-right font-medium`}>{naira(a.invoiced_kobo)}</td>
                  <td className={`${table.td} text-right text-ink/60`}>{naira(a.collected_kobo)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function LatestPayments({ rows }: { rows: Payment[] }) {
  if (!rows.length) return <Empty icon="receipt">No payments yet.</Empty>;
  return (
    <>
      {/* Phone: one compact row per payment. */}
      <ul className={`${table.list} md:hidden`}>
        {rows.map((p) => {
          const name = p.business_name ?? "—";
          return (
            <li key={p.id} className={`${table.item} flex items-center gap-3`}>
              <Avatar name={name} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{name}</p>
                <p className="mt-0.5 truncate text-xs text-ink/50">
                  {p.client_name ?? "—"}
                  {p.document_ref && <span className="font-mono"> · {p.document_ref}</span>}
                </p>
              </div>
              <div className="shrink-0 text-right tabular-nums">
                <p className="text-sm font-medium">{naira(p.client_total_kobo)}</p>
                <p className="mt-0.5 text-xs whitespace-nowrap text-ink/50">
                  {p.provider === "paystack" ? "Card" : "Transfer"} · {shortDate(p.at)}
                </p>
              </div>
            </li>
          );
        })}
      </ul>

      <div className={`${table.wrap} hidden md:block`}>
        <table className={`${table.table} min-w-[460px]`}>
          <thead className={table.head}>
            <tr>
              <th className={table.th}>Business</th>
              <th className={table.th}>Method</th>
              <th className={table.th}>Date</th>
              <th className={`${table.th} text-right`}>Amount</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {rows.map((p) => {
              const name = p.business_name ?? "—";
              return (
                <tr key={p.id} className={table.row}>
                  <td className={`${table.td} w-full max-w-0`}>
                    <div className="flex items-center gap-3">
                      <Avatar name={name} />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{name}</p>
                        <p className="truncate text-xs text-ink/50">
                          {p.client_name ?? "—"}
                          {p.document_ref && <span className="font-mono"> · {p.document_ref}</span>}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className={table.td}>
                    <Pill tone={p.provider === "paystack" ? "marigold" : "neutral"}>
                      {p.provider === "paystack" ? "Card" : "Transfer"}
                    </Pill>
                  </td>
                  <td className={`${table.td} whitespace-nowrap text-ink/60`}>{shortDate(p.at)}</td>
                  <td className={`${table.td} text-right font-medium`}>{naira(p.client_total_kobo)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Pieces                                                                     */
/* -------------------------------------------------------------------------- */

function Mini({ label, value, tone }: { label: string; value: number; tone?: "moss" | "clay" }) {
  return (
    <div className="px-2 py-3 text-center">
      <p
        className={`font-display text-[1.3rem] leading-tight font-light tracking-[-0.025em] tabular-nums ${
          tone === "moss" ? "text-moss" : tone === "clay" ? "text-clay" : ""
        }`}
      >
        {value.toLocaleString("en-NG")}
      </p>
      <p className="mt-0.5 text-xs text-ink/50">{label}</p>
    </div>
  );
}

/*
 * WhatsApp, as Meta reports it: what it charged, and every message it priced,
 * billable or free. Counts come from Meta's delivery reports and are exact;
 * spend comes from its pricing analytics and lags a day, so the card says
 * how far it goes.
 */
const CATEGORY: Record<string, string> = {
  marketing: "Marketing",
  utility: "Utility",
  service: "Replies in the chat",
  authentication: "Codes",
  referral_conversion: "From ads",
};
const FREE: Record<string, string> = {
  free_customer_service: "free, in the 24-hour window",
  free_entry_point: "free, from an ad or button",
};

function WhatsAppCard({ w }: { w: WhatsApp | null }) {
  if (!w) {
    return (
      <Card title="WhatsApp" sub="What Meta charged">
        <Empty icon="message">Cannot read WhatsApp costs yet. The API update that adds them has to deploy first.</Empty>
      </Card>
    );
  }
  const spend = w.spend_30d_kobo;
  const costs = new Map(w.spend_by_category.map((s) => [`${s.category}|${s.pricing_type}`, s.cost_kobo ?? null]));
  const rows = w.priced_by_category.slice(0, 5);

  return (
    <Card
      title="WhatsApp"
      sub={w.spend_reported_through ? `As Meta charged it, through ${shortDate(w.spend_reported_through)}` : "Meta has not reported spend yet"}
    >
      <p className="font-display text-[1.6rem] leading-tight font-light tracking-[-0.025em] tabular-nums">
        {spend === null ? "—" : naira(spend)}
      </p>
      <p className="mt-0.5 text-xs text-ink/45">
        {spend === null
          ? "Spend appears within a day of Meta reporting it."
          : w.spend_unconverted_days > 0
            ? `30 days. ${w.spend_unconverted_days} day(s) had no naira rate and are left out.`
            : "30 days, in naira at each day's rate."}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-ink/[0.04] px-3.5 py-3">
          <p className="font-display text-lg tabular-nums">{w.billable_messages_30d.toLocaleString("en-NG")}</p>
          <p className="text-xs text-ink/50">Billable messages</p>
        </div>
        <div className="rounded-2xl bg-moss/[0.08] px-3.5 py-3">
          <p className="font-display text-lg text-moss tabular-nums">{w.free_messages_30d.toLocaleString("en-NG")}</p>
          <p className="text-xs text-ink/50">Free messages</p>
        </div>
      </div>

      {rows.length > 0 ? (
        <dl className="mt-4 space-y-2.5 border-t border-line pt-3.5 text-sm">
          {rows.map((r) => {
            const cost = costs.get(`${r.category}|${r.pricing_type}`);
            return (
              <div key={`${r.category}|${r.pricing_type}`} className="flex items-baseline justify-between gap-3">
                <dt className="min-w-0 text-ink/65">
                  {CATEGORY[r.category] ?? r.category}
                  <span className="text-ink/40"> · {FREE[r.pricing_type] ?? `${(r.billable ?? 0).toLocaleString("en-NG")} billable`}</span>
                </dt>
                <dd className="shrink-0 text-right tabular-nums">
                  {r.messages.toLocaleString("en-NG")}
                  {cost != null && cost > 0 && <span className="text-ink/45"> · {naira(cost)}</span>}
                </dd>
              </div>
            );
          })}
        </dl>
      ) : (
        <p className="mt-4 border-t border-line pt-3.5 text-xs text-ink/45">No messages priced in the last 30 days.</p>
      )}
      <p className="mt-3 text-xs text-ink/40">{w.sent_messages_30d.toLocaleString("en-NG")} sent in 30 days, from Meta&apos;s delivery reports.</p>
    </Card>
  );
}

function Row({ k, v, strong, muted }: { k: string; v: string; strong?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={muted ? "text-ink/45" : "text-ink/65"}>{k}</dt>
      <dd className={`shrink-0 text-right tabular-nums ${strong ? "font-medium text-ink" : muted ? "text-ink/45" : ""}`}>{v}</dd>
    </div>
  );
}

/** "25 Sep", for chart labels where the year is noise. */
const dayMonth = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Africa/Lagos" }).format(new Date(iso));

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
