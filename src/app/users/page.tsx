import { naira, shortDate } from "@/lib/money";
import { loadAccounts, loadUnverifiedSubaccounts, type AccountSort } from "@/lib/dashboard";
import { Avatar, Card, Empty, Notice, Pill, Segmented, Stat, btn, fieldWithIcon, statGrid, table } from "@/components/ui";
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
        <Notice tone={params.plan_error ? "clay" : "moss"} role="status" className="mb-4">
          {params.plan_error ?? params.plan_ok}
        </Notice>
      )}

      {accounts.data && (
        <div className={`mb-4 ${statGrid}`}>
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
          <form method="get" className="flex w-full gap-2 lg:max-w-md">
            <input type="hidden" name="sort" value={sort} />
            <label className="relative flex-1">
              <span className="sr-only">Search users</span>
              <Icon name="search" className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink/40" />
              <input
                type="search"
                name="q"
                defaultValue={q}
                placeholder="Business, phone or email"
                className={fieldWithIcon}
              />
            </label>
            <button type="submit" className={btn.primary}>
              Search
            </button>
          </form>
          <Segmented current={sort} items={SORTS.map((s) => ({ id: s.id, label: s.label, href: href(s.id) }))} />
        </div>

        {accounts.error ? (
          <div className="px-4 pb-4 sm:px-5 sm:pb-5">
            <Failed what="users" error={accounts.error} />
          </div>
        ) : rows.length === 0 ? (
          <div className="border-t border-line">
            <Empty icon="users">{q ? `Nobody matches “${q}”.` : "No users yet."}</Empty>
          </div>
        ) : (
          <>
          {/* Phone and tablet: one card per account, the figures that matter first. */}
          <ul className={`${table.list} lg:hidden`}>
            {rows.map((a) => {
              const name = a.business_name ?? `+${a.wa_phone}`;
              const flags = !a.onboarded_at || toVerify.has(a.id) || a.status !== "active";
              return (
                <li key={a.id} className={`${table.item} flex gap-3`}>
                  <Avatar name={name} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className={`truncate font-medium ${a.business_name ? "" : "text-ink/45"}`}>
                        {a.business_name ?? "Not set up"}
                      </p>
                      <p className="shrink-0 text-sm font-medium tabular-nums">{naira(a.invoiced_kobo)}</p>
                    </div>
                    <div className="mt-0.5 flex items-baseline justify-between gap-3 text-xs text-ink/50">
                      <p className="truncate font-mono">+{a.wa_phone}</p>
                      <p className="shrink-0 tabular-nums">{naira(a.collected_kobo)} collected</p>
                    </div>
                    {a.email && (
                      <p className="mt-0.5 truncate text-xs text-ink/50">
                        {a.email}
                        {!a.email_verified && <span className="text-clay"> · unverified</span>}
                      </p>
                    )}
                    {flags && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {!a.onboarded_at && <Pill tone="marigold">Setup unfinished</Pill>}
                        {toVerify.has(a.id) && <Pill tone="clay">Verify on Paystack</Pill>}
                        {a.status !== "active" && <Pill tone="clay">{a.status}</Pill>}
                      </div>
                    )}
                    <dl className="mt-3 grid grid-cols-3 gap-2 rounded-2xl bg-paper px-3 py-2.5 text-xs tabular-nums">
                      <div className="min-w-0">
                        <dt className="text-ink/45">Invoices</dt>
                        <dd className="mt-0.5 font-medium">
                          {a.invoices} <span className="font-normal text-moss">· {a.invoices_paid} paid</span>
                        </dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-ink/45">Unpaid</dt>
                        <dd className={`mt-0.5 truncate font-medium ${a.outstanding_kobo > 0 ? "text-clay" : "text-ink/40"}`}>
                          {naira(a.outstanding_kobo)}
                        </dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-ink/45">Last active</dt>
                        <dd className="mt-0.5 truncate font-medium">{a.last_active_at ? shortDate(a.last_active_at) : "—"}</dd>
                      </div>
                    </dl>
                    <div className="mt-3">
                      <PlanCell
                        userId={a.id}
                        plan={a.plan === "pro" ? "pro" : "free"}
                        until={proUntil.get(a.id) ?? null}
                        canChange={canChange}
                        back={here}
                        inline
                      />
                    </div>
                    <p className="mt-2 text-[0.7rem] text-ink/40">Joined {shortDate(a.created_at)}</p>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className={`${table.wrap} hidden lg:block`}>
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
                      <td className={`${table.td} text-right font-medium`}>{naira(a.invoiced_kobo)}</td>
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
          </>
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
  inline = false,
}: {
  userId: string;
  plan: "pro" | "free";
  until: string | null;
  canChange: boolean;
  back: string;
  /** On a phone: plan, end date and the menu's toggle along one line. */
  inline?: boolean;
}) {
  const pro = plan === "pro";
  return (
    <div className={inline ? "flex flex-wrap items-center gap-x-2.5 gap-y-1" : "flex flex-col items-start gap-1"}>
      <Pill tone={pro ? "ink" : "neutral"} dot={false}>
        {pro ? "Pro" : "Free"}
      </Pill>
      {pro && <p className="text-xs whitespace-nowrap text-ink/45">{until ? `until ${shortDate(until)}` : "no end date"}</p>}
      {canChange && (
        <details className={`group relative ${inline ? "ml-auto [&[open]]:basis-full" : ""}`}>
          <summary
            className={`cursor-pointer list-none font-medium [&::-webkit-details-marker]:hidden ${
              inline
                ? "inline-flex h-10 items-center rounded-full border border-line bg-white px-3.5 text-xs text-ink/70 hover:text-ink"
                : "inline-flex h-7 items-center text-xs text-ink/55 underline decoration-ink/20 underline-offset-4 hover:text-ink"
            }`}
          >
            {pro ? "Change" : "Promote"}
          </summary>
          <div
            className={`mt-2 rounded-[18px] border border-line bg-white p-3 shadow-[0_12px_32px_-12px_rgba(16,35,28,0.25)] ${
              inline ? "w-full" : "w-64"
            }`}
          >
            <form action={setPlan} className="space-y-2">
              <input type="hidden" name="user" value={userId} />
              <input type="hidden" name="to" value="pro" />
              <input type="hidden" name="back" value={back} />
              <label className="block text-xs font-medium text-ink/55">
                {pro ? "Set Pro to end" : "Make Pro for"}
                <select
                  name="months"
                  defaultValue="1"
                  className="mt-1 h-10 w-full rounded-xl border border-line bg-white px-2.5 text-base text-ink outline-none focus:border-ink/40 focus:ring-4 focus:ring-ink/[0.06] focus-visible:outline-none sm:text-sm"
                >
                  <option value="1">1 month from today</option>
                  <option value="3">3 months from today</option>
                  <option value="6">6 months from today</option>
                  <option value="12">12 months from today</option>
                  <option value="0">No end date</option>
                </select>
              </label>
              <button type="submit" className={`${btn.primary} w-full`}>
                {pro ? "Update Pro" : "Promote to Pro"}
              </button>
            </form>
            {pro && (
              <form action={setPlan} className="mt-2 border-t border-line pt-2">
                <input type="hidden" name="user" value={userId} />
                <input type="hidden" name="to" value="free" />
                <input type="hidden" name="back" value={back} />
                <button type="submit" className={`${btn.ghostDanger} w-full`}>
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
