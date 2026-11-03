import { naira, shortDate } from "@/lib/money";
import {
  cameBack,
  loadAccounts,
  loadActivation,
  loadActive,
  loadCohorts,
  loadDaily,
  loadInsights,
  loadOverview,
  loadPayments,
  loadSetup,
  loadUnverifiedSubaccounts,
  loadWeekly,
  PAYSTACK_SUBACCOUNTS_URL,
  type Account,
  type Activation,
  type Active,
  type Cohort,
  type Day,
  type Insights,
  type Overview,
  type Payment,
  type Setup,
  type Week,
} from "@/lib/dashboard";
import { MiniBars, weekChange } from "@/components/charts";
import { Avatar, Card, Empty, Kpi, MoreLink, Notice, Pill, SectionTitle, Stat, btn, statGrid, table } from "@/components/ui";
import { formatHours } from "./parts";
import { Failed, gate, Shell } from "./shell";

export const dynamic = "force-dynamic";

/*
 * The business at a glance (3 November 2026: the detail moved to Analytics).
 *
 * Four headline figures, four that say whether it is healthy, what happened
 * in the last hours and days, and who bills the most and was paid last.
 * Every figure is defined once, in the admin_* views in the API's
 * migrations; this page only lays them out.
 */
export default async function OverviewPage() {
  const g = await gate();
  if (!g.staff) return g.stop;

  const [overview, daily, insights, top, recent, setup, active, weekly, activation, cohorts] = await Promise.all([
    loadOverview(),
    loadDaily(),
    loadInsights(),
    loadAccounts("", "invoiced"),
    loadPayments("success"),
    loadSetup(),
    loadActive(),
    loadWeekly(),
    loadActivation(),
    loadCohorts(),
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
      sub="How it is going, whether it is healthy, and who is using it."
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
          <Headline
            o={overview.data!}
            days={daily.data}
            s={setup.data}
            onPro={onPro}
            active={active.data}
            weekly={weekly.data}
          />
          <Pulse o={overview.data!} i={insights.data} activation={activation.data} cohorts={cohorts.data} />
          <RightNow o={overview.data!} />
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
    </Shell>
  );
}

/* -------------------------------------------------------------------------- */
/* Headline                                                                   */
/* -------------------------------------------------------------------------- */

function Headline({
  o,
  days,
  s,
  onPro,
  active,
  weekly,
}: {
  o: Overview;
  days: Day[];
  s: Setup | null;
  onPro: number | null;
  active: Active | null;
  weekly: Week[] | null;
}) {
  const collected = days.map((d) => d.collected_kobo);
  // A user is somebody who finished setup, so the bars are setups finished.
  const setups = s ? days.map((d) => s.finishedOn[d.day] ?? 0) : null;
  const sending =
    active && active.active_prev_7d > 0 ? ((active.active_7d - active.active_prev_7d) / active.active_prev_7d) * 100 : active?.active_7d ? null : 0;

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
        value={o.users_onboarded.toLocaleString("en-NG")}
        note={s ? `${s.finished24h} finished setup in the last 24 hours` : "Finished setup"}
        delta={setups ? weekChange(setups) : undefined}
      >
        {setups && <MiniBars values={setups} />}
      </Kpi>
      {/* The one number that says whether Balans is growing: businesses actually using it. */}
      <Kpi
        label="Businesses sending, 7 days"
        icon="activity"
        value={active ? active.active_7d.toLocaleString("en-NG") : "—"}
        note={active ? `${active.active_30d} in 30 days · sent at least one document` : "Sent at least one document"}
        delta={active ? sending : undefined}
      >
        {weekly && <MiniBars values={weekly.map((w) => w.active)} />}
      </Kpi>
    </section>
  );
}


/* -------------------------------------------------------------------------- */
/* Pulse                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Whether it is healthy, in four figures: do people come back, do they start
 * fast, do their clients pay, and how quickly. The detail is on Analytics.
 */
function Pulse({
  o,
  i,
  activation,
  cohorts,
}: {
  o: Overview;
  i: Insights | null;
  activation: Activation | null;
  cohorts: Cohort[] | null;
}) {
  const back = cohorts ? cameBack(cohorts) : null;
  const paidOf = o.invoices_paid + o.invoices_unpaid;
  return (
    <>
      <SectionTitle
        title="Is it healthy"
        sub="Whether people come back, start fast, and get paid."
        action={<MoreLink href="/analytics">All analytics</MoreLink>}
      />
      <div className={statGrid}>
        <Stat
          icon="users"
          label="Sent again in week 2"
          value={back?.pct == null ? "—" : `${Math.round(back.pct)}%`}
          note={back?.of ? `Of ${back.of} who set up two weeks ago or more` : "Needs two full weeks of sign-ups"}
        />
        <Stat
          icon="zap"
          label="First document within a day"
          value={activation && activation.set_up_1d > 0 ? `${Math.round((100 * activation.first_doc_1d) / activation.set_up_1d)}%` : "—"}
          note={activation ? `${activation.never_sent} set up and never sent` : undefined}
          tone={activation?.never_sent ? "clay" : undefined}
        />
        <Stat
          icon="check"
          label="Invoices paid"
          value={paidOf > 0 ? `${Math.round((100 * o.invoices_paid) / paidOf)}%` : "—"}
          note={`${o.invoices_overdue} overdue now`}
          tone={o.invoices_overdue ? "clay" : undefined}
        />
        <Stat
          icon="clock"
          label="Time to get paid"
          value={i?.median_hours_to_paid == null ? "—" : formatHours(i.median_hours_to_paid)}
          note="Median, from sent to paid"
        />
      </div>
    </>
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
