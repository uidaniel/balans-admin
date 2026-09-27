import Link from "next/link";
import { naira } from "@/lib/money";
import { loadPayments } from "@/lib/dashboard";
import { Failed, gate, Shell } from "../shell";

export const dynamic = "force-dynamic";

const FILTERS = [
  { id: "success", label: "Paid" },
  { id: "initialised", label: "Started" },
  { id: "failed", label: "Failed" },
  { id: "needs_review", label: "Needs review" },
  { id: "all", label: "All" },
] as const;

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
      sub={
        payments.data
          ? `${rows.length} shown · ${naira(sum((p) => p.client_total_kobo))} paid by clients · ${naira(
              sum((p) => p.balans_fee_kobo),
            )} to Balans · ${naira(sum((p) => p.provider_fee_kobo))} to processors`
          : undefined
      }
    >
      <nav className="mb-5 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.id}
            href={`/payments?status=${f.id}`}
            aria-current={f.id === status ? "page" : undefined}
            className={`inline-flex h-9 items-center rounded-full px-4 text-sm font-semibold ring-1 ring-inset ${
              f.id === status ? "bg-ink text-cream ring-ink" : "bg-white text-ink/60 ring-ink/15 hover:text-ink"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      {payments.error ? (
        <Failed what="payments" error={payments.error} />
      ) : rows.length === 0 ? (
        <p className="rounded-[20px] bg-white px-5 py-4 text-sm text-ink/55 ring-1 ring-ink/10 ring-inset">
          No payments here.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-[20px] bg-white ring-1 ring-ink/10 ring-inset">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="text-ink/45">
              <tr>
                <th className="px-5 py-3 font-semibold">When</th>
                <th className="px-3 py-3 font-semibold">Business</th>
                <th className="px-3 py-3 font-semibold">Client</th>
                <th className="px-3 py-3 font-semibold">Invoice</th>
                <th className="px-3 py-3 font-semibold">How</th>
                <th className="px-3 py-3 text-right font-semibold">Client paid</th>
                <th className="px-3 py-3 text-right font-semibold">Processor</th>
                <th className="px-3 py-3 text-right font-semibold">Balans</th>
                <th className="px-5 py-3 text-right font-semibold">To user</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {rows.map((p) => (
                <tr key={p.id} className="border-t border-ink/8">
                  <td className="px-5 py-3 whitespace-nowrap text-ink/60">{when(p.at)}</td>
                  <td className="px-3 py-3 font-semibold">{p.business_name ?? "—"}</td>
                  <td className="px-3 py-3">{p.client_name ?? "—"}</td>
                  <td className="px-3 py-3 font-mono text-xs">{p.document_ref ?? "—"}</td>
                  <td className="px-3 py-3">
                    {p.provider === "paystack" ? "Card" : "Transfer"}
                    {p.currency !== "NGN" && <span className="ml-1 text-xs text-ink/50">{p.currency}</span>}
                    {p.status !== "success" && <span className="ml-1 text-xs text-clay">{p.status}</span>}
                  </td>
                  <td className="px-3 py-3 text-right font-semibold">{naira(p.client_total_kobo)}</td>
                  <td className="px-3 py-3 text-right text-ink/60">{naira(p.provider_fee_kobo)}</td>
                  <td className="px-3 py-3 text-right text-ink/60">{naira(p.balans_fee_kobo)}</td>
                  <td className="px-5 py-3 text-right">{naira(p.to_user_kobo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Shell>
  );
}
