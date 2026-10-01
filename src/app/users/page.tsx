import { naira, shortDate } from "@/lib/money";
import { loadAccounts, loadUnverifiedSubaccounts, type AccountSort } from "@/lib/dashboard";
import { Avatar, Card, Empty, Pill, Segmented, Stat, table } from "@/components/ui";
import { Icon } from "@/components/icons";
import { serviceClient } from "@/lib/supabase";
import { Failed, gate, Shell } from "../shell";
import { setPlan } from "./actions";

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
  searchParams: Promise<{ q?: string; sort?: string; plan_ok?: string; plan_error?: string }>;
}) {
  const g = await gate();
  if (!g.staff) return g.stop;

  const params = await searchParams;
  const q = (params.q ?? "").slice(0, 80);
  const sort = (SORTS.find((s) => s.id === params.sort)?.id ?? "invoiced") as AccountSort;
  const [accounts, pros] = await Promise.all([
    loadAccounts(q, sort),
    // Only Pro accounts have an end date worth showing, and there are few of them.
    serviceClient().from("users").select("id, plan_expires_at").eq("plan", "pro"),
  ]);
  const unverified = await loadUnverifiedSubaccounts();
  const toVerify = new Set((unverified.data ?? []).map((u) => u.userId));
  const proUntil = new Map((pros.data ?? []).map((u) => [u.id as string, (u.plan_expires_at as string | null) ?? null]));
  const canChange = g.staff.role === "admin";
  const here = `/users?${new URLSearchParams({ ...(q ? { q } : {}), sort }).toString()}`;

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
      {(params.plan_ok || params.plan_error) && (
        <div
          className={`mb-4 flex gap-3 rounded-2xl border px-5 py-3.5 text-sm ${
            params.plan_error ? "border-clay/20 bg-clay/[0.05] text-clay" : "border-moss/20 bg-moss/[0.06] text-moss"
          }`}
        >
          <Icon name={params.plan_error ? "alert" : "check"} className="mt-0.5 size-4 shrink-0" />
          <p>{params.plan_error ?? params.plan_ok}</p>
        </div>
      )}

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
                              {toVerify.has(a.id) && <Pill tone="clay">Verify on Paystack</Pill>}
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
                        <PlanCell
                          userId={a.id}
                          plan={a.plan === "pro" ? "pro" : "free"}
                          until={proUntil.get(a.id) ?? null}
                          canChange={canChange}
                          back={here}
                        />
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

/**
 * The plan, when it ends, and — for an admin — a small menu to change it.
 * A <details> so it works with no client code, like the rest of this page.
 */
function PlanCell({
  userId,
  plan,
  until,
  canChange,
  back,
}: {
  userId: string;
  plan: "pro" | "free";
  until: string | null;
  canChange: boolean;
  back: string;
}) {
  const pro = plan === "pro";
  return (
    <div className="flex flex-col items-start gap-1">
      <Pill tone={pro ? "ink" : "neutral"} dot={false}>
        {pro ? "Pro" : "Free"}
      </Pill>
      {pro && <p className="text-xs whitespace-nowrap text-ink/45">{until ? `until ${shortDate(until)}` : "no end date"}</p>}
      {canChange && (
        <details className="group relative">
          <summary className="cursor-pointer list-none text-xs font-medium text-ink/55 hover:text-ink [&::-webkit-details-marker]:hidden">
            {pro ? "Change" : "Promote"}
          </summary>
          <div className="mt-2 w-60 rounded-xl border border-line bg-white p-3 shadow-[0_8px_24px_rgba(16,35,28,0.12)]">
            <form action={setPlan} className="space-y-2">
              <input type="hidden" name="user" value={userId} />
              <input type="hidden" name="to" value="pro" />
              <input type="hidden" name="back" value={back} />
              <label className="block text-xs font-medium text-ink/55">
                {pro ? "Set Pro to end" : "Make Pro for"}
                <select
                  name="months"
                  defaultValue="1"
                  className="mt-1 h-9 w-full rounded-lg border border-line bg-white px-2 text-sm text-ink outline-none focus:border-ink/40"
                >
                  <option value="1">1 month from today</option>
                  <option value="3">3 months from today</option>
                  <option value="6">6 months from today</option>
                  <option value="12">12 months from today</option>
                  <option value="0">No end date</option>
                </select>
              </label>
              <button
                type="submit"
                className="h-9 w-full rounded-lg bg-ink text-sm font-medium text-cream transition-colors hover:bg-ink-3"
              >
                {pro ? "Update Pro" : "Promote to Pro"}
              </button>
            </form>
            {pro && (
              <form action={setPlan} className="mt-2 border-t border-line pt-2">
                <input type="hidden" name="user" value={userId} />
                <input type="hidden" name="to" value="free" />
                <input type="hidden" name="back" value={back} />
                <button
                  type="submit"
                  className="h-9 w-full rounded-lg text-sm font-medium text-clay transition-colors hover:bg-clay/[0.07]"
                >
                  Demote to Free
                </button>
                <p className="mt-1 text-[0.7rem] leading-snug text-ink/45">
                  Takes effect now, and cancels their subscription so nothing more is collected.
                </p>
              </form>
            )}
          </div>
        </details>
      )}
    </div>
  );
}
