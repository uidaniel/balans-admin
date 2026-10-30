import { naira } from "@/lib/money";
import { loadPayments } from "@/lib/dashboard";
import { Avatar, Card, Empty, Pill, Segmented, Stat, statGrid, table, type PillTone } from "@/components/ui";
import { Failed, gate, Shell } from "../shell";

export const dynamic = "force-dynamic";

const FILTERS = [
  { id: "success", label: "Paid" },
  { id: "initialised", label: "Started" },
  { id: "failed", label: "Failed" },
  { id: "needs_review", label: "Needs review" },
  { id: "all", label: "All" },
] as const;

const STATUS: Record<string, { label: string; tone: PillTone }> = {
  success: { label: "Paid", tone: "moss" },
  initialised: { label: "Started", tone: "neutral" },
  failed: { label: "Failed", tone: "clay" },
  needs_review: { label: "Needs review", tone: "marigold" },
};

const when = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Lagos",
  }).format(new Date(iso));

/**
 * Every payment, newest first — the ledger staff read when somebody says they
 * paid. Shows the split: what the client paid, what the processor took, what
 * Balans took, and what reached the user.
 */
export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const g = await gate();
  if (!g.staff) return g.stop;

  const params = await searchParams;
  const status = FILTERS.find((f) => f.id === params.status)?.id ?? "success";
  const payments = await loadPayments(status);
  const rows = payments.data ?? [];
  const sum = (pick: (p: (typeof rows)[number]) => number) => rows.reduce((t, p) => t + pick(p), 0);

  return (
    <Shell
      email={g.staff.email}
      current="/payments"
      title="Payments"
      sub="The ledger, newest first: what the client paid, and where each naira went."
    >
      {payments.data && (
        <div className={`mb-4 ${statGrid}`}>
          <Stat icon="wallet" label="Paid by clients" value={naira(sum((p) => p.client_total_kobo))} note={`${rows.length} payments shown`} />
          <Stat icon="trending" label="To Balans" value={naira(sum((p) => p.balans_fee_kobo))} tone="moss" />
          <Stat icon="card" label="To processors" value={naira(sum((p) => p.provider_fee_kobo))} />
          <Stat icon="send" label="Reached users" value={naira(sum((p) => p.to_user_kobo))} />
        </div>
      )}

      <Card flush>
        <div className="flex flex-col gap-3 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-[0.95rem] leading-snug font-medium tracking-[-0.01em]">All payments</h3>
            <p className="mt-0.5 text-[0.8rem] text-ink/50">Up to 500, newest first</p>
          </div>
          <Segmented current={status} items={FILTERS.map((f) => ({ id: f.id, label: f.label, href: `/payments?status=${f.id}` }))} />
        </div>

        {payments.error ? (
          <div className="px-4 pb-4 sm:px-5 sm:pb-5">
            <Failed what="payments" error={payments.error} />
          </div>
        ) : rows.length === 0 ? (
          <div className="border-t border-line">
            <Empty icon="receipt">No payments here.</Empty>
          </div>
        ) : (
          <>
          {/* Phone and tablet: one card per payment, with the split underneath. */}
          <ul className={`${table.list} lg:hidden`}>
            {rows.map((p) => {
              const name = p.business_name ?? "—";
              const st = STATUS[p.status] ?? { label: p.status, tone: "neutral" as const };
              return (
                <li key={p.id} className={`${table.item} flex gap-3`}>
                  <Avatar name={name} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="truncate font-medium">{name}</p>
                      <p className="shrink-0 text-sm font-medium tabular-nums">{naira(p.client_total_kobo)}</p>
                    </div>
                    <div className="mt-0.5 flex items-baseline justify-between gap-3 text-xs text-ink/50">
                      <p className="truncate">
                        {p.client_name ?? "—"}
                        {p.document_ref && <span className="font-mono"> · {p.document_ref}</span>}
                      </p>
                      <p className="shrink-0 tabular-nums">{when(p.at)}</p>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Pill tone={st.tone}>{st.label}</Pill>
                      <Pill tone={p.provider === "paystack" ? "marigold" : "neutral"} dot={false}>
                        {p.provider === "paystack" ? "Card" : "Transfer"}
                      </Pill>
                      {p.currency !== "NGN" && <span className="text-xs font-medium text-ink/50">{p.currency}</span>}
                    </div>
                    <dl className="mt-3 grid grid-cols-3 gap-2 rounded-2xl bg-paper px-3 py-2.5 text-xs tabular-nums">
                      <div className="min-w-0">
                        <dt className="text-ink/45">Processor</dt>
                        <dd className="mt-0.5 truncate text-ink/60">{naira(p.provider_fee_kobo)}</dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-ink/45">Balans</dt>
                        <dd className="mt-0.5 truncate font-medium text-moss">{naira(p.balans_fee_kobo)}</dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-ink/45">To user</dt>
                        <dd className="mt-0.5 truncate font-medium">{naira(p.to_user_kobo)}</dd>
                      </div>
                    </dl>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className={`${table.wrap} hidden lg:block`}>
            <table className={`${table.table} min-w-255`}>
              <thead className={table.head}>
                <tr>
                  <th className={table.th}>Business</th>
                  <th className={table.th}>Invoice</th>
                  <th className={table.th}>Method</th>
                  <th className={table.th}>Status</th>
                  <th className={table.th}>When</th>
                  <th className={`${table.th} text-right`}>Client paid</th>
                  <th className={`${table.th} text-right`}>Processor</th>
                  <th className={`${table.th} text-right`}>Balans</th>
                  <th className={`${table.th} text-right`}>To user</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {rows.map((p) => {
                  const name = p.business_name ?? "—";
                  const st = STATUS[p.status] ?? { label: p.status, tone: "neutral" as const };
                  return (
                    <tr key={p.id} className={table.row}>
                      <td className={table.td}>
                        <div className="flex items-center gap-3">
                          <Avatar name={name} />
                          <div className="min-w-0">
                            <p className="truncate font-medium">{name}</p>
                            <p className="truncate text-xs text-ink/50">{p.client_name ?? "—"}</p>
                          </div>
                        </div>
                      </td>
                      <td className={`${table.td} font-mono text-xs text-ink/70`}>{p.document_ref ?? "—"}</td>
                      <td className={table.td}>
                        <span className="inline-flex items-center gap-1.5">
                          <Pill tone={p.provider === "paystack" ? "marigold" : "neutral"} dot={false}>
                            {p.provider === "paystack" ? "Card" : "Transfer"}
                          </Pill>
                          {p.currency !== "NGN" && <span className="text-xs font-medium text-ink/50">{p.currency}</span>}
                        </span>
                      </td>
                      <td className={table.td}>
                        <Pill tone={st.tone}>{st.label}</Pill>
                      </td>
                      <td className={`${table.td} whitespace-nowrap text-ink/60`}>{when(p.at)}</td>
                      <td className={`${table.td} text-right font-medium`}>{naira(p.client_total_kobo)}</td>
                      <td className={`${table.td} text-right text-ink/55`}>{naira(p.provider_fee_kobo)}</td>
                      <td className={`${table.td} text-right text-moss`}>{naira(p.balans_fee_kobo)}</td>
                      <td className={`${table.td} text-right`}>{naira(p.to_user_kobo)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
      </Card>
    </Shell>
  );
}
