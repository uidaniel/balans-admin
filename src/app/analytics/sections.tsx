import { naira, shortDate } from "@/lib/money";
import {
  SOURCE_NAME,
  type Activation,
  type Cohort,
  type Day,
  type Insights,
  type InvoiceLoop,
  type Loaded,
  type Overview,
  type Setup,
  type Sources,
  type Week,
  type WhatsApp,
} from "@/lib/dashboard";
import { ColumnChart, Donut, DualBars, Funnel, Gauge, HourStrip, RankedBars } from "@/components/charts";
import { Card, Empty, SectionTitle, Stat, statGrid, table } from "@/components/ui";
import { Failed } from "../shell";
import { notYet, type SetupStep } from "@/lib/test-data";
import { Mini, Row, dayMonth, formatHours, formatMinutes, share, titleCase } from "../parts";

/*
 * The Analytics page's sections, one per tab (3 November 2026). Moved here
 * from the Overview, which now keeps only the headline figures. Every number
 * is defined in the API's admin_* views; these only lay them out.
 */

/* -------------------------------------------------------------------------- */
/* Growth                                                                     */
/* -------------------------------------------------------------------------- */

export function GrowthSection({
  o,
  days,
  i,
  s,
  onPro,
  weekly,
  sources,
  loop,
  steps,
}: {
  o: Overview;
  days: Day[];
  i: Insights | null;
  s: Loaded<Setup>;
  steps: { data: SetupStep[] | null; error: string | null };
  onPro: number | null;
  weekly: Loaded<Week[]>;
  sources: Loaded<Sources>;
  loop: Loaded<InvoiceLoop>;
}) {
  const conversion = o.users_active_30d > 0 ? (100 * o.pro_users) / o.users_active_30d : null;
  const verified = s.data ? `${s.data.emailVerified.toLocaleString("en-NG")}${share(s.data.emailVerified, s.data.finished, " of finished setup")}` : "—";
  return (
    <>
      <SectionTitle title="Who is joining" sub="How many, from where, and how far they get." />
      <div className={statGrid}>
        <Stat icon="check" label="Finished setup" value={String(o.users_onboarded)} note={`of ${o.users_total} who started setup`} />
        <Stat icon="activity" label="Active, 30 days" value={String(o.users_active_30d)} note="Sent at least one document" />
        <Stat
          icon="zap"
          label="On Pro"
          value={String(onPro ?? o.pro_users)}
          note={`${o.pro_users} paying${conversion === null ? "" : ` · ${conversion.toFixed(1)}% of active users`}`}
        />
        <Stat
          icon="alert"
          label="Started, not finished"
          value={(o.users_total - o.users_onboarded).toLocaleString("en-NG")}
          note="Messaged Balans but never finished setup"
          tone={o.users_total - o.users_onboarded > 0 ? "clay" : undefined}
        />
      </div>
      <WeeklyActive weekly={weekly} />
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
              {/*
               * Email is not a step: it is asked after the first invoice and
               * confirmed by link, so it sits beside the funnel, against those
               * who finished setup. A bank account is, now setup lets them
               * skip it; it comes from `users` (loadSetup), so it is left out
               * rather than guessed when that read fails.
               */}
              <Funnel
                steps={[
                  { label: "Started setup", value: i.funnel_signed_up },
                  { label: "Finished setup", value: i.funnel_set_up },
                  ...(s.data ? [{ label: "Added bank account", value: s.data.banked }] : []),
                  { label: "Sent a document", value: i.funnel_first_document },
                  { label: "Got paid", value: i.funnel_first_paid },
                  { label: "Paid for Pro", value: i.funnel_ever_pro },
                ]}
              />
              <dl className="mt-5 space-y-2.5 border-t border-line pt-3.5 text-sm">
                <Row k="Email verified" v={verified} />
                {i.median_minutes_to_first_document !== null && (
                  <Row k="Sign-up to first document, median" v={formatMinutes(i.median_minutes_to_first_document)} muted />
                )}
              </dl>
            </>
          ) : (
            <Empty icon="filter">Insights not available yet.</Empty>
          )}
        </Card>
      </div>
      <SignupSources s={sources} />
      <InvoiceLoopCard loop={loop} />
      <SetupNudges s={s} />
      <SetupSteps steps={steps} />
    </>
  );
}

/** Businesses that sent at least one document, each week: the number that says whether Balans is growing. */
function WeeklyActive({ weekly }: { weekly: Loaded<Week[]> }) {
  if (!weekly.data) {
    return (
      <Card className="mt-4" title="Businesses sending each week">
        <Failed what="weekly activity" error={weekly.error} />
      </Card>
    );
  }
  const weeks = weekly.data;
  const now = weeks.at(-1);
  const last = weeks.at(-2);
  return (
    <Card
      className="mt-4"
      title="Businesses sending each week"
      sub="Sent at least one document, Monday to Sunday. The week on the right is still going."
      action={
        <div className="shrink-0 text-right">
          <p className="font-display text-[1.35rem] leading-tight font-light tracking-[-0.025em] tabular-nums">{now?.active ?? 0}</p>
          <p className="mt-0.5 text-xs text-ink/45">{last ? `${last.active} last week` : "this week"}</p>
        </div>
      }
    >
      <ColumnChart points={weeks.map((w) => ({ label: dayMonth(w.week), value: w.active }))} format={(v) => String(Math.round(v))} />
      <p className="mt-3 border-t border-line pt-3 text-xs text-ink/45">
        New businesses each week: {weeks.slice(-6).map((w) => w.new_users).join(" · ")} (last six weeks).
      </p>
    </Card>
  );
}

/**
 * Invoices as a way in (3 November 2026): every free invoice carries "Made
 * with Balans", a link that opens the chat with "(ref: invoice)". A client who
 * runs a business of their own is the cheapest user there is.
 */
function InvoiceLoopCard({ loop }: { loop: Loaded<InvoiceLoop> }) {
  if (!loop.data) {
    return (
      <Card className="mt-4" title="Invoices bringing in users">
        <Failed what="the invoice loop" error={loop.error} />
      </Card>
    );
  }
  const l = loop.data;
  const steps = [
    { k: "Clients opened an invoice", v: l.opened_30d, note: `last 30 days · ${l.opened_total.toLocaleString("en-NG")} ever` },
    { k: "Tapped “Made with Balans”", v: l.taps, note: share(l.taps, l.opened_total, " of opens").replace(/^ · /, "") || "since 3 November" },
    { k: "Messaged Balans", v: l.messaged, note: share(l.messaged, l.taps, " of taps").replace(/^ · /, "") || "—" },
    { k: "Finished setup", v: l.finished, note: share(l.finished, l.messaged, " of those").replace(/^ · /, "") || "—" },
  ];
  return (
    <Card className="mt-4" title="Invoices bringing in users" sub="“Made with Balans” on free invoices, tapped by the client who got it">
      <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4 sm:divide-x sm:divide-line">
        {steps.map((c) => (
          <div key={c.k} className="min-w-0 sm:px-5 sm:first:pl-0 sm:last:pr-0">
            <p className="text-xs font-medium text-ink/45">{c.k}</p>
            <p className="mt-2 font-display text-[1.6rem] leading-tight font-light tracking-[-0.03em] tabular-nums">
              {c.v.toLocaleString("en-NG")}
            </p>
            <p className="text-xs text-ink/50">{c.note}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

/**
 * Where sign-ups come from (3 November 2026), and how far each source's
 * people got. Recorded by the bot from each first message; everybody before
 * that shows as "Before tracking".
 */
function SignupSources({ s }: { s: Loaded<Sources> }) {
  if (!s.data) {
    return (
      <Card className="mt-4" title="Where sign-ups come from">
        <Failed what="sign-up sources" error={s.error} />
      </Card>
    );
  }
  const { rows, detail } = s.data;
  const pct = (n: number, of: number) => (of > 0 ? `${Math.round((n / of) * 100)}%` : "—");
  const cols = ["Tapped the link", "Messaged Balans", "Finished setup", "Sent an invoice", "Got paid", "Pro"] as const;
  return (
    <Card
      className="mt-4"
      flush
      title="Where sign-ups come from"
      sub="Taps on our tagged links, then each person's first message: an ad, a link, the waitlist, or direct"
    >
      <div className={table.wrap}>
        <table className={`${table.table} min-w-160`}>
          <thead className={table.head}>
            <tr>
              <th className={table.th}>Source</th>
              {cols.map((c) => (
                <th key={c} className={`${table.th} text-right`}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {rows.map((r) => (
              <tr key={r.source} className={table.row}>
                <td className={`${table.td} font-medium ${r.source === "none" ? "text-ink/45" : ""}`}>{SOURCE_NAME[r.source] ?? r.source}</td>
                {/* Ads and posts are counted by Meta, and Direct has no link to tap. */}
                <td className={`${table.td} text-right`}>
                  {r.clicks === null ? <span className="text-ink/30">—</span> : r.clicks.toLocaleString("en-NG")}
                </td>
                <td className={`${table.td} text-right`}>
                  {r.signedUp.toLocaleString("en-NG")}
                  {r.clicks ? <span className="text-xs text-ink/45"> {pct(r.signedUp, r.clicks)}</span> : null}
                </td>
                {[r.finished, r.sent, r.paid, r.pro].map((n, i) => (
                  <td key={i} className={`${table.td} text-right`}>
                    {n.toLocaleString("en-NG")} <span className="text-xs text-ink/45">{pct(n, r.signedUp)}</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {detail.length > 0 && (
        <div className="border-t border-line px-4 py-4 sm:px-5">
          <p className="text-xs font-medium text-ink/45">By ad and link</p>
          <ul className="mt-2 divide-y divide-line">
            {detail.map((d) => (
              <li key={d.label} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                <span className="min-w-0 truncate">{d.label}</span>
                <span className="shrink-0 text-xs text-ink/55 tabular-nums">
                  {d.clicks !== null && `${d.clicks} tapped · `}
                  {d.signedUp} messaged · {d.finished} finished · {d.sent} sent
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

/*
 * Where people stop in setup (5 November 2026; API migration 0072). Each
 * step is written the first time somebody reaches it, by the setup form or
 * by typing, so this counts only people who joined since then.
 */
const STEPS: { label: string; keys: string[] }[] = [
  { label: "Messaged Balans", keys: ["started"] },
  { label: "Got the setup card", keys: ["welcome"] },
  { label: "Gave the business name", keys: ["business", "onboarding:business_name"] },
  { label: "Gave bank or payment details", keys: ["payout", "mfb", "abroad", "onboarding:bank"] },
  { label: "Checked the account name", keys: ["confirm", "onboarding:confirm_account"] },
  { label: "Finished setup", keys: ["finished"] },
];

function SetupSteps({ steps }: { steps: { data: SetupStep[] | null; error: string | null } }) {
  if (!steps.data) {
    return (
      <Card className="mt-4" title="Where setup stops">
        {notYet(steps.error) ? (
          <p className="text-sm text-ink/55">Comes with the next API release, which starts recording each step.</p>
        ) : (
          <Failed what="setup steps" error={steps.error ?? "unknown"} />
        )}
      </Card>
    );
  }
  const count = new Map(steps.data.map((r) => [r.step, r.people]));
  // A step reached by the form or by typing is the same step: the larger
  // of the two, so one person is never counted twice.
  const rows = STEPS.map((st) => ({ label: st.label, n: Math.max(0, ...st.keys.map((k) => count.get(k) ?? 0)) }));
  const top = rows[0]!.n;
  return (
    <Card
      className="mt-4"
      title="Where setup stops"
      sub="People who joined in the last 30 days, since steps were first recorded"
    >
      {top === 0 ? (
        <p className="text-sm text-ink/55">Nobody new since steps started being recorded.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r, idx) => {
            const pct = top ? Math.round((100 * r.n) / top) : 0;
            const prev = idx > 0 ? rows[idx - 1]!.n : null;
            const lost = prev !== null && prev > r.n ? prev - r.n : 0;
            return (
              <li key={r.label}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-ink/75">{r.label}</span>
                  <span className="tabular-nums">
                    {r.n.toLocaleString("en-NG")} <span className="text-ink/45">· {pct}%</span>
                    {lost > 0 && <span className="text-clay"> · {lost} stopped here</span>}
                  </span>
                </div>
                <div className="mt-1.5 h-2 rounded-full bg-paper">
                  <div className="h-2 rounded-full bg-moss" style={{ width: `${pct}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/*
 * Somebody who stops part-way through setup gets two touches (the API's
 * jobs/setup-nudges.ts): one in the chat a few hours on, and a template and
 * an email two days on. Each is counted with how many finished after it,
 * then who has still not finished, nudged or not.
 */
function SetupNudges({ s }: { s: Loaded<Setup> }) {
  if (!s.data) {
    return (
      <Card className="mt-4" title="Setup nudges">
        <Failed what="setup nudges" error={s.error} />
      </Card>
    );
  }
  const d = s.data;
  const cols = [
    { k: "Chat nudges", v: d.nudged, note: `${d.nudgedFinished} finished after${share(d.nudgedFinished, d.nudged)}` },
    { k: "Follow-ups", v: d.followedUp, note: `${d.followedUpFinished} finished after${share(d.followedUpFinished, d.followedUp)}` },
    { k: "Still not set up", v: d.stuck, note: `${d.stuckNudged} nudged · ${d.stuck - d.stuckNudged} not yet` },
  ];
  return (
    <Card className="mt-4" title="Setup nudges" sub="For people who stopped part-way: in the chat after a few hours, then a template and email two days on">
      <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 sm:divide-x sm:divide-line">
        {cols.map((c) => (
          <div key={c.k} className="min-w-0 sm:px-5 sm:first:pl-0 sm:last:pr-0">
            <p className="text-xs font-medium text-ink/45">{c.k}</p>
            <p className="mt-2 font-display text-[1.6rem] leading-tight font-light tracking-[-0.03em] tabular-nums">
              {c.v.toLocaleString("en-NG")}
            </p>
            <p className="text-xs text-ink/50">{c.note}</p>
          </div>
        ))}
      </div>
      <p className="mt-5 border-t border-line pt-3 text-xs text-ink/45">
        Counted when the job picks somebody, before the send, so one WhatsApp would not deliver still counts.
      </p>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Money                                                                      */
/* -------------------------------------------------------------------------- */

export function MoneySection({ o, i, w }: { o: Overview; i: Insights | null; w: WhatsApp | null }) {
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

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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

export function InvoicesPaid({ o }: { o: Overview }) {
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

export function UsageSection({ o, i }: { o: Overview; i: Insights }) {
  const hours = Array.from({ length: 24 }, (_, h) => i.documents_by_hour.find((s) => Number(s.k) === h)?.n ?? 0);
  return (
    <>
      <SectionTitle title="How it is used" sub="What people send, how it looks, and what happens to it." />
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
        <Card title="Designs chosen">
          <RankedBars items={i.designs.map((s) => ({ label: titleCase(String(s.k)), value: s.n }))} />
        </Card>
        <Card title="When invoices go out" sub="By hour of day">
          <HourStrip counts={hours} />
          <div className="mt-5 grid grid-cols-3 divide-x divide-line rounded-2xl border border-line bg-paper">
            <Mini label="Invoices" value={o.invoices_total} />
            <Mini label="Quotes" value={o.quotes_total} />
            <Mini label="Requests" value={o.requests_total} />
          </div>
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
/* Retention                                                                  */
/* -------------------------------------------------------------------------- */

const pctOf = (part: number, whole: number): string => (whole > 0 ? `${Math.round((100 * part) / whole)}%` : "—");

export function RetentionSection({
  activation,
  cohorts,
  proLapsed,
}: {
  activation: Loaded<Activation>;
  cohorts: Loaded<Cohort[]>;
  proLapsed: number | null;
}) {
  const a = activation.data;
  return (
    <>
      <SectionTitle title="Getting started" sub="How fast people who finish setup send something and get paid." />
      {a ? (
        <>
          <div className={statGrid}>
            <Stat
              icon="zap"
              label="First document within a day"
              value={pctOf(a.first_doc_1d, a.set_up_1d)}
              note={`${a.first_doc_1d} of ${a.set_up_1d} set up a day ago or more`}
            />
            <Stat
              icon="file"
              label="Within 7 days"
              value={pctOf(a.first_doc_7d, a.set_up_7d)}
              note={`${a.first_doc_7d} of ${a.set_up_7d} set up a week ago or more`}
            />
            <Stat
              icon="wallet"
              label="Got paid within 30 days"
              value={pctOf(a.first_paid_30d, a.set_up_30d)}
              note={`${a.first_paid_30d} of ${a.set_up_30d} set up a month ago or more`}
            />
            <Stat
              icon="alert"
              label="Never sent anything"
              value={a.never_sent.toLocaleString("en-NG")}
              note="Finished setup, no document yet"
              tone={a.never_sent > 0 ? "clay" : undefined}
            />
          </div>
          <Card className="mt-4" title="How long it takes" sub="Medians">
            <dl className="space-y-3.5 text-sm">
              <Row k="First message to finished setup" v={a.median_minutes_to_setup === null ? "—" : formatMinutes(a.median_minutes_to_setup)} />
              <Row k="Setup to first document" v={a.median_minutes_to_first_doc === null ? "—" : formatMinutes(a.median_minutes_to_first_doc)} />
              <Row k="Setup to first payment" v={a.median_hours_to_first_paid === null ? "—" : formatHours(a.median_hours_to_first_paid)} />
              {proLapsed !== null && <Row k="Pro not renewed, 30 days" v={proLapsed.toLocaleString("en-NG")} muted />}
            </dl>
          </Card>
        </>
      ) : (
        <Failed what="activation" error={activation.error ?? ""} />
      )}

      <SectionTitle title="Whether people stay" sub="Each row is the people who finished setup that week; each column, how many sent a document in that week of theirs." />
      <Cohorts cohorts={cohorts} />
    </>
  );
}

const COHORT_WEEKS = [0, 1, 2, 3, 4, 6, 8] as const;

/**
 * Week 0 is a person's first seven days after setup. A figure in grey is
 * still filling in: some of that row's people have not reached the week yet.
 */
function Cohorts({ cohorts }: { cohorts: Loaded<Cohort[]> }) {
  if (!cohorts.data) return <Failed what="retention" error={cohorts.error} />;
  if (!cohorts.data.length) {
    return (
      <Card>
        <Empty icon="users">Nobody has finished setup in the last twelve weeks.</Empty>
      </Card>
    );
  }
  return (
    <Card flush>
      <div className={table.wrap}>
        <table className={`${table.table} min-w-160`}>
          <thead className={table.head}>
            <tr>
              <th className={table.th}>Set up in the week of</th>
              <th className={`${table.th} text-right`}>People</th>
              {COHORT_WEEKS.map((w) => (
                <th key={w} className={`${table.th} text-center`}>
                  Week {w}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {cohorts.data.map((c) => (
              <tr key={c.week} className={table.row}>
                <td className={`${table.td} font-medium whitespace-nowrap`}>{dayMonth(c.week)}</td>
                <td className={`${table.td} text-right`}>{c.users}</td>
                {COHORT_WEEKS.map((w) => {
                  const n = c[`w${w}` as const];
                  const done = w < c.weeks_complete;
                  const started = w <= c.weeks_complete + 1;
                  const pct = c.users > 0 ? (100 * n) / c.users : 0;
                  return (
                    <td key={w} className="px-1.5 py-1.5 text-center">
                      {started ? (
                        <span
                          title={`${n} of ${c.users}${done ? "" : ", so far"}`}
                          className={`block rounded-lg px-2 py-2 text-[0.8rem] ${done ? "text-ink" : "text-ink/40 italic"}`}
                          style={{ background: done ? `rgba(63,143,95,${(0.06 + (pct / 100) * 0.4).toFixed(3)})` : "rgba(16,35,28,0.03)" }}
                        >
                          {Math.round(pct)}%
                        </span>
                      ) : (
                        <span className="text-ink/20">·</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-line px-4 py-3 text-xs text-ink/45 sm:px-5">
        Grey and slanted: still filling in. A healthy product keeps week 4 and on from falling towards zero.
      </p>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* WhatsApp                                                                   */
/* -------------------------------------------------------------------------- */

export function WhatsAppSection({ w, i }: { w: WhatsApp | null; i: Insights | null }) {
  return (
    <>
      <SectionTitle title="WhatsApp" sub="What Meta charged, and what goes back and forth in the chat." />
      <div className="grid gap-4 lg:grid-cols-3">
        <WhatsAppCard w={w} />
        {i ? (
          <>
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
            <Card title="What the bot sent" sub="Last 30 days">
              <RankedBars
                items={i.messages_by_kind_30d.slice(0, 8).map((s) => ({ label: titleCase(String(s.k)), value: s.n }))}
                color="#3f8f5f"
              />
            </Card>
          </>
        ) : (
          <Card className="lg:col-span-2">
            <Empty icon="message">Insights not available yet.</Empty>
          </Card>
        )}
      </div>
    </>
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

export function WhatsAppCard({ w }: { w: WhatsApp | null }) {
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
