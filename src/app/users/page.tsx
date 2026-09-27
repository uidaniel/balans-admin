import { naira, shortDate } from "@/lib/money";
import { loadAccounts, type AccountSort } from "@/lib/dashboard";
import { Avatar, Card, Empty, Pill, Segmented, Stat, table } from "@/components/ui";
import { Icon } from "@/components/icons";
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
 * A plain GET form for the search and links for the sort, so the address is
 * the state: a filtered list can be bookmarked or sent to somebody, and it
 * works with nothing on the page but HTML.
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

  const href = (s: string) => `/users?${new URLSearchParams({ ...(q ? { q } : {}), sort: s }).toString()}`;

  return (
    <Shell
      email={g.staff.email}
      current="/users"
      title="Users"
      sub="Every account, with what they have billed and been paid."
    >
      {accounts.data && (
        <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat
            icon="users"
            label={q ? "Matching" : "Accounts"}
            value={rows.length.toLocaleString("en-NG")}
            note={`${totals.pro} on Pro`}
          />
          <Stat icon="file" label="Invoiced" value={naira(totals.invoiced)} />
          <Stat icon="wallet" label="Collected" value={naira(totals.collected)} tone="moss" />
          <Stat
            icon="alert"
            label="Unpaid"
            value={naira(totals.outstanding)}
            tone={totals.outstanding > 0 ? "clay" : undefined}
          />
        </div>
      )}

      <Card flush>
        <div className="flex flex-col gap-3 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
          <form method="get" className="flex w-full max-w-md gap-2">
            <input type="hidden" name="sort" value={sort} />
            <label className="relative flex-1">
              <span className="sr-only">Search users</span>
              <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink/40" />
              <input
                type="search"
                name="q"
                defaultValue={q}
                placeholder="Business, phone or email"
                className="h-10 w-full rounded-xl border border-line bg-white pr-3 pl-9 text-sm outline-none placeholder:text-ink/40 focus:border-ink/40 focus:ring-4 focus:ring-ink/5"
              />
            </label>
            <button
              type="submit"
              className="h-10 rounded-xl bg-ink px-4 text-sm font-medium text-cream transition-colors hover:bg-ink-3"
            >
              Search
            </button>
          </form>
          <Segmented current={sort} items={SORTS.map((s) => ({ id: s.id, label: s.label, href: href(s.id) }))} />
        </div>

        {accounts.error ? (
          <div className="px-5 pb-5">
            <Failed what="users" error={accounts.error} />
          </div>
        ) : rows.length === 0 ? (
          <div className="border-t border-line">
            <Empty icon="users">{q ? `Nobody matches “${q}”.` : "No users yet."}</Empty>
          </div>
        ) : (
          <div className={table.wrap}>
            <table className={`${table.table} min-w-280`}>
              <thead className={table.head}>
                <tr>
                  <th className={table.th}>Business</th>
                  <th className={table.th}>Contact</th>
                  <th className={table.th}>Plan</th>
                  <th className={table.th}>Joined</th>
                  <th className={table.th}>Last active</th>
                  <th className={`${table.th} text-right`}>Invoices</th>
                  <th className={`${table.th} text-right`}>Invoiced</th>
                  <th className={`${table.th} text-right`}>Collected</th>
                  <th className={`${table.th} text-right`}>Outstanding</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {rows.map((a) => {
                  const name = a.business_name ?? `+${a.wa_phone}`;
                  return (
                    <tr key={a.id} className={table.row}>
                      <td className={table.td}>
                        <div className="flex items-center gap-3">
                          <Avatar name={name} />
                          <div className="min-w-0">
                            <p className={`truncate font-medium ${a.business_name ? "" : "text-ink/45"}`}>
                              {a.business_name ?? "Not set up"}
                            </p>
                            <div className="mt-0.5 flex flex-wrap gap-1">
                              {!a.onboarded_at && <Pill tone="marigold">Setup unfinished</Pill>}
                              {a.status !== "active" && <Pill tone="clay">{a.status}</Pill>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className={table.td}>
                        <p className="font-mono text-xs">+{a.wa_phone}</p>
                        {a.email && (
                          <p className="mt-0.5 text-xs text-ink/55">
                            {a.email}
                            {!a.email_verified && <span className="text-clay"> · unverified</span>}
                          </p>
                        )}
                      </td>
                      <td className={table.td}>
                        <Pill tone={a.plan === "pro" ? "ink" : "neutral"} dot={false}>
                          {a.plan === "pro" ? "Pro" : "Free"}
                        </Pill>
                      </td>
                      <td className={`${table.td} whitespace-nowrap text-ink/60`}>{shortDate(a.created_at)}</td>
                      <td className={`${table.td} whitespace-nowrap text-ink/60`}>
                        {a.last_active_at ? shortDate(a.last_active_at) : "—"}
                      </td>
                      <td className={`${table.td} text-right`}>
                        <span className="font-medium">{a.invoices}</span>
                        <p className="text-xs whitespace-nowrap text-ink/45">
                          <span className="text-moss">{a.invoices_paid} paid</span> · {a.invoices_unpaid} unpaid
                        </p>
                      </td>
                      <td className={`${table.td} text-right font-semibold`}>{naira(a.invoiced_kobo)}</td>
                      <td className={`${table.td} text-right`}>{naira(a.collected_kobo)}</td>
                      <td className={`${table.td} text-right ${a.outstanding_kobo > 0 ? "font-medium text-clay" : "text-ink/40"}`}>
                        {naira(a.outstanding_kobo)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </Shell>
  );
}
