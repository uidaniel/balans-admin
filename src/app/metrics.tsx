import { naira } from "@/lib/money";
import { Empty, Pill, SectionTitle } from "@/components/ui";

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
  const known = ok !== null && ok !== undefined;
  return (
    <div className="flex flex-col rounded-2xl border border-line bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-ink/55">{label}</p>
        {known && (
          <Pill tone={ok ? "moss" : "clay"}>{ok ? "On track" : "Below target"}</Pill>
        )}
      </div>
      <p
        className={`mt-2 font-display text-[1.6rem] leading-tight font-semibold tracking-tight tabular-nums ${
          !known ? "" : ok ? "text-moss" : "text-clay"
        }`}
      >
        {value}
      </p>
      {target && (
        <p className="mt-1 text-xs text-ink/45">
          Target <span className="font-semibold text-ink/70">{target}</span>
        </p>
      )}
      {hint && <p className="mt-3 border-t border-line pt-3 text-xs leading-relaxed text-ink/55">{hint}</p>}
    </div>
  );
}

export function MetricsPanel({ m }: { m: Metrics | null }) {
  if (!m) {
    return (
      <div className="mt-10 rounded-2xl border border-line bg-white">
        <Empty icon="shield">No health checks yet. They appear once the first invoice is sent.</Empty>
      </div>
    );
  }

  const conversion = num(m.pro_conversion_pct);
  const paymentRate = num(m.payment_rate_pct);
  const avgInvoice = num(m.avg_invoice_naira);
  const perPro = num(m.docs_per_pro_user);
  const contribution = num(m.contribution_naira_30d);

  return (
    <section>
      <SectionTitle
        title="Health checks"
        sub="Rolling 30 days, each against the level where it stops being fine. Active means they sent something, not that they signed up."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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

      <h3 className="mt-8 mb-3 text-sm font-semibold text-ink/70">Unit economics</h3>
      <div className="grid gap-4 sm:grid-cols-3">
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
