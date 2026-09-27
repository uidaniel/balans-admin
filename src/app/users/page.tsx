import { naira, shortDate } from "@/lib/money";
import { loadAccounts, type AccountSort } from "@/lib/dashboard";
import { Failed, gate, Shell } from "../shell";

export const dynamic = "force-dynamic";

const SORTS: { id: AccountSort; label: string }[] = [
  { id: "invoiced", label: "Most invoiced" },
  { id: "collected", label: "Most collected" },
  { id: "outstanding", label: "Most unpaid" },
  { id: "newest", label: "Newest" },
  { id: "active", label: "Last active" },
];

/**
 * Every user, with what they have billed and been paid.
 *
 * A plain GET form for the search and the sort, so the address is the state:
 * a filtered list can be bookmarked or sent to somebody, and it works with
 * nothing on the page but HTML.
 */
export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string }>;
}) {
  const g = await gate();
  if (!g.staff) return g.stop;

  const params = await searchParams;
  const q = (params.q ?? "").slice(0, 80);
  const sort = (SORTS.find((s) => s.id === params.sort)?.id ?? "invoiced") as AccountSort;
  const accounts = await loadAccounts(q, sort);

  const rows = accounts.data ?? [];
  const totals = rows.reduce(
    (t, a) => ({
      invoiced: t.invoiced + a.invoiced_kobo,
      collected: t.collected + a.collected_kobo,
      outstanding: t.outstanding + a.outstanding_kobo,
      pro: t.pro + (a.plan === "pro" ? 1 : 0),
    }),
    { invoiced: 0, collected: 0, outstanding: 0, pro: 0 },
  );

  return (
    <Shell
      email={g.staff.email}
      current="/users"
      title="Users"
      sub={
        accounts.data
          ? `${rows.length} ${q ? "matching" : "in all"} · ${totals.pro} on Pro · ${naira(totals.invoiced)} invoiced · ${naira(totals.collected)} collected · ${naira(totals.outstanding)} unpaid`
          : undefined
      }
    >
      <form method="get" className="mb-5 flex flex-wrap gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Business, phone or email"
          className="h-10 min-w-[240px] flex-1 rounded-full bg-white px-4 text-sm ring-1 ring-ink/15 outline-none ring-inset focus:ring-ink/50"
        />
        <select
          name="sort"
          defaultValue={sort}
          className="h-10 rounded-full bg-white px-4 text-sm ring-1 ring-ink/15 ring-inset"
        >
          {SORTS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <button type="submit" className="h-10 rounded-full bg-ink px-5 text-sm font-semibold text-cream">
          Show
        </button>
      </form>

      {accounts.error ? (
        <Failed what="users" error={accounts.error} />
      ) : rows.length === 0 ? (
        <p className="rounded-[20px] bg-white px-5 py-4 text-sm text-ink/55 ring-1 ring-ink/10 ring-inset">
          {q ? `Nobody matches “${q}”.` : "No users yet."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-[20px] bg-white ring-1 ring-ink/10 ring-inset">
          <table className="w-full min-w-[1080px] text-left text-sm">
            <thead className="text-ink/45">
              <tr>
                <th className="px-5 py-3 font-semibold">Business</th>
                <th className="px-3 py-3 font-semibold">Contact</th>
                <th className="px-3 py-3 font-semibold">Plan</th>
                <th className="px-3 py-3 font-semibold">Joined</th>
                <th className="px-3 py-3 font-semibold">Last active</th>
                <th className="px-3 py-3 text-right font-semibold">Invoices</th>
                <th className="px-3 py-3 text-right font-semibold">Paid</th>
                <th className="px-3 py-3 text-right font-semibold">Unpaid</th>
                <th className="px-3 py-3 text-right font-semibold">Invoiced</th>
                <th className="px-3 py-3 text-right font-semibold">Collected</th>
                <th className="px-5 py-3 text-right font-semibold">Outstanding</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {rows.map((a) => (
                <tr key={a.id} className="border-t border-ink/8 align-top">
                  <td className="px-5 py-3">
                    <p className="font-semibold">{a.business_name ?? <span className="text-ink/40">Not set up</span>}</p>
                    {!a.onboarded_at && <p className="text-xs text-clay">Setup unfinished</p>}
                    {a.status !== "active" && <p className="text-xs text-clay">{a.status}</p>}
                  </td>
                  <td className="px-3 py-3">
                    <p className="font-mono text-xs">+{a.wa_phone}</p>
                    {a.email && (
                      <p className="text-xs text-ink/55">
                        {a.email}
                        {!a.email_verified && <span className="text-clay"> · unverified</span>}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        a.plan === "pro" ? "bg-ink text-cream" : "bg-ink/8 text-ink/60"
                      }`}
                    >
                      {a.plan === "pro" ? "Pro" : "Free"}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-ink/60">{shortDate(a.created_at)}</td>
                  <td className="px-3 py-3 text-ink/60">{a.last_active_at ? shortDate(a.last_active_at) : "—"}</td>
                  <td className="px-3 py-3 text-right">{a.invoices}</td>
                  <td className="px-3 py-3 text-right text-moss">{a.invoices_paid}</td>
                  <td className="px-3 py-3 text-right">{a.invoices_unpaid}</td>
                  <td className="px-3 py-3 text-right font-semibold">{naira(a.invoiced_kobo)}</td>
                  <td className="px-3 py-3 text-right">{naira(a.collected_kobo)}</td>
                  <td className={`px-5 py-3 text-right ${a.outstanding_kobo > 0 ? "text-clay" : "text-ink/40"}`}>
                    {naira(a.outstanding_kobo)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Shell>
  );
}
