import { naira } from "@/lib/money";

/**
 * The numbers that decide whether the campaigns are working.
 *
 * Read from the `admin_metrics` view rather than assembled here, so there is
 * one definition of "active user" and "payment rate" shared with anything else
 * that asks. Everything is a rolling 30 days, so a figure means the same thing
 * on the 2nd as on the 28th.
 *
 * Each one carries the level at which it stops being fine, because a number
 * without a threshold is decoration — the point of this page is to notice,
 * early, that something has slipped.
 */
export type Metrics = {
  users_total: number;
  users_active: number;
  pro_active: number;
  pro_lapsed_30d: number;
  pro_conversion_pct: string | null;
  documents_30d: number;
  documents_paid_30d: number;
  payment_rate_pct: string | null;
  avg_invoice_naira: string | null;
  billed_naira_30d: string | null;
  docs_per_pro_user: string | null;
  fees_earned_naira_30d: string | null;
  message_cost_naira_30d: string | null;
  contribution_naira_30d: string | null;
};

const num = (v: string | number | null): number | null =>
  v === null || v === "" ? null : Number(v);

/** A figure, what it should be, and whether it is. */
function Metric({
  label,
  value,
  target,
  ok,
  hint,
}: {
  label: string;
  value: string;
  target?: string;
  ok?: boolean | null;
  hint?: string;
}) {
  const tone =
    ok === null || ok === undefined
      ? "text-ink/35"
      : ok
        ? "text-moss"
        : "text-clay";

  return (
    <div className="rounded-2xl bg-white px-5 py-4 ring-1 ring-ink/10 ring-inset">
      <p className="text-[0.7rem] font-semibold tracking-[0.08em] text-ink/45 uppercase">{label}</p>
      <p className={`mt-1 font-display text-2xl font-bold tracking-tight ${tone}`}>{value}</p>
      {target && <p className="mt-1 text-xs text-ink/45">Target {target}</p>}
      {hint && <p className="mt-2 text-xs leading-relaxed text-ink/55">{hint}</p>}
    </div>
  );
}

export function MetricsPanel({ m }: { m: Metrics | null }) {
  if (!m) {
    return (
      <p className="rounded-2xl bg-white px-5 py-4 text-sm text-ink/55 ring-1 ring-ink/10 ring-inset">
        No metrics yet. They appear once the first invoice is sent.
      </p>
    );
  }

  const conversion = num(m.pro_conversion_pct);
  const paymentRate = num(m.payment_rate_pct);
  const avgInvoice = num(m.avg_invoice_naira);
  const perPro = num(m.docs_per_pro_user);
  const contribution = num(m.contribution_naira_30d);

  return (
    <section className="mt-8">
      <h2 className="font-display text-lg font-bold tracking-tight">Last 30 days</h2>
      <p className="mt-1 text-sm text-ink/55">
        Active means they sent something, not that they signed up.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Metric
          label="Active users"
          value={`${m.users_active} of ${m.users_total}`}
          hint="About 31 active users covers a lean setup; 137 if the monthly bill reaches ₦80,000."
        />
        <Metric
          label="Pro conversion"
          value={conversion === null ? "—" : `${conversion}%`}
          target=">10%"
          ok={conversion === null ? null : conversion >= 10}
          hint={`${m.pro_active} paying. Plan on 8–10%; 15% is a stretch. Below 10% you need far more users for the same money.`}
        />
        <Metric
          label="Invoices per Pro user"
          value={perPro === null ? "—" : String(perPro)}
          target=">8/month"
          ok={perPro === null ? null : perPro >= 8}
          hint="Under five and they are paying ₦4,000 for what Free already gives them. That is churn arriving."
        />
        <Metric
          label="Payment rate"
          value={paymentRate === null ? "—" : `${paymentRate}%`}
          target=">70%"
          ok={paymentRate === null ? null : paymentRate >= 70}
          hint={`${m.documents_paid_30d} paid of ${m.documents_30d} sent. A Free user costs ₦154 a month whatever the rate, so on small invoices they go negative below about 51%.`}
        />
        <Metric
          label="Average invoice"
          value={avgInvoice === null ? "—" : naira(Math.round(avgInvoice * 100))}
          target=">₦20,000"
          ok={avgInvoice === null ? null : avgInvoice >= 20_000}
          hint="Free-tier value scales almost linearly with this. It is no longer where the risk sits — watch the payment rate instead."
        />
        <Metric
          label="Pro cancellations"
          value={String(m.pro_lapsed_30d)}
          target="<5% of Pro"
          ok={m.pro_active === 0 ? null : m.pro_lapsed_30d / Math.max(m.pro_active, 1) < 0.05}
          hint="Subscriptions that ended and were not replaced."
        />
      </div>

      <h2 className="mt-10 font-display text-lg font-bold tracking-tight">Money</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Metric
          label="Fees earned"
          value={naira(Math.round((num(m.fees_earned_naira_30d) ?? 0) * 100))}
        />
        <Metric
          label="WhatsApp cost"
          value={naira(Math.round((num(m.message_cost_naira_30d) ?? 0) * 100))}
          hint="Every outbound message is charged from 1 October 2026."
        />
        <Metric
          label="Contribution"
          value={naira(Math.round((contribution ?? 0) * 100))}
          ok={contribution === null ? null : contribution > 0}
          hint="Fees earned less what it cost to send them. Before servers and hosting."
        />
      </div>
    </section>
  );
}
