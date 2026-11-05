import Link from "next/link";
import { naira, shortDate } from "@/lib/money";
import { loadTestData, notYet, type Suspect } from "@/lib/test-data";
import { Card, Empty, Notice, Pill, btn } from "@/components/ui";
import { Failed, gate, Shell } from "../shell";
import { setLeftOut, setTestAccount } from "./actions";

export const dynamic = "force-dynamic";

/*
 * Test data (5 November 2026). What looks like a test, grouped by account,
 * with why; what has been marked, with a way to put it back. A marked
 * account, or an invoice left out, counts in no total anywhere in the admin
 * (API migration 0074). The lists of users and payments still show it.
 */

export default async function TestDataPage({
  searchParams,
}: {
  searchParams: Promise<{ test_ok?: string; test_error?: string }>;
}) {
  const g = await gate();
  if (!g.staff) return g.stop;
  const params = await searchParams;
  const isAdmin = g.staff.role === "admin";
  const { data, error } = await loadTestData();

  return (
    <Shell
      email={g.staff.email}
      current="/test-data"
      title="Test data"
      sub="Tests and trials, kept out of every total. Nothing here is deleted, and every mark can be taken back."
    >
      {(params.test_ok || params.test_error) && (
        <Notice tone={params.test_error ? "clay" : "moss"} role="status" className="mb-4">
          {params.test_error ?? params.test_ok}
        </Notice>
      )}

      {!data ? (
        notYet(error) ? (
          <Notice tone="marigold" title="Comes with the next release">
            Marking test data needs the API update that adds it. Once that is live, this page fills in.
          </Notice>
        ) : (
          <Failed what="test data" error={error ?? "unknown"} />
        )
      ) : (
        <>
          <Suspects suspects={data.suspects} isAdmin={isAdmin} />

          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <Card title="Test accounts" sub="Every invoice and payment of these is left out" flush>
              {data.accounts.length === 0 ? (
                <div className="px-4 pb-5 sm:px-6">
                  <Empty icon="users">No account is marked as a test.</Empty>
                </div>
              ) : (
                <ul className="divide-y divide-line/80 border-t border-line">
                  {data.accounts.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
                      <div className="min-w-0">
                        <Link href={`/users/${a.id}`} className="font-medium hover:underline">
                          {a.business_name ?? `+${a.wa_phone}`}
                        </Link>
                        <p className="text-xs text-ink/50">Joined {shortDate(a.created_at)}</p>
                      </div>
                      {isAdmin && (
                        <form action={setTestAccount}>
                          <input type="hidden" name="user" value={a.id} />
                          <input type="hidden" name="on" value="0" />
                          <button className={btn.secondary}>Put back</button>
                        </form>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card title="Invoices left out" sub="Single invoices, on accounts that otherwise count" flush>
              {data.leftOut.length === 0 ? (
                <div className="px-4 pb-5 sm:px-6">
                  <Empty icon="file">No single invoice is left out.</Empty>
                </div>
              ) : (
                <ul className="divide-y divide-line/80 border-t border-line">
                  {data.leftOut.map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
                      <div className="min-w-0">
                        <p className="font-medium">
                          {d.type === "quote" ? "Quote" : "Invoice"}
                          {d.number ? ` #${d.number}` : ""} · {naira(d.total_kobo)}
                        </p>
                        <p className="truncate text-xs text-ink/50">
                          {d.users?.business_name ?? "—"} to {d.clients?.name ?? "—"}
                        </p>
                      </div>
                      {isAdmin && (
                        <form action={setLeftOut}>
                          <input type="hidden" name="document" value={d.id} />
                          <input type="hidden" name="on" value="0" />
                          <button className={btn.secondary}>Put back</button>
                        </form>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </Shell>
  );
}

/** What the rules caught, account by account, for somebody to decide on. */
function Suspects({ suspects, isAdmin }: { suspects: Suspect[]; isAdmin: boolean }) {
  const byUser = new Map<string, Suspect[]>();
  for (const s of suspects) byUser.set(s.user_id, [...(byUser.get(s.user_id) ?? []), s]);

  return (
    <Card
      title="Looks like a test"
      sub="Sent to their own number, a client called test, a client with the business's own name, or under ₦500 or over ₦5,000,000"
      flush
    >
      {byUser.size === 0 ? (
        <div className="px-4 pb-5 sm:px-6">
          <Empty icon="check">Nothing looks like a test right now.</Empty>
        </div>
      ) : (
        <div className="divide-y divide-line border-t border-line">
          {[...byUser.entries()].map(([userId, docs]) => (
            <div key={userId} className="px-4 py-4 sm:px-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/users/${userId}`} className="font-medium hover:underline">
                    {docs[0]!.business_name ?? "No business name"}
                  </Link>
                  <p className="text-xs text-ink/50">
                    {docs.length} {docs.length === 1 ? "invoice" : "invoices"} caught
                  </p>
                </div>
                {isAdmin && (
                  <form action={setTestAccount}>
                    <input type="hidden" name="user" value={userId} />
                    <input type="hidden" name="on" value="1" />
                    <button className={btn.secondary}>Mark whole account as test</button>
                  </form>
                )}
              </div>
              <ul className="mt-3 space-y-2">
                {docs.map((d) => (
                  <li
                    key={d.document_id}
                    className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-2xl bg-paper px-3.5 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-sm">
                        <span className="font-medium">
                          {d.type === "quote" ? "Quote" : "Invoice"}
                          {d.number ? ` #${d.number}` : ""}
                        </span>{" "}
                        · {d.client_name ?? "no client"} · {naira(d.total_kobo)}
                        <span className="text-ink/45"> · {shortDate(d.created_at)}</span>
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {d.reasons.map((r) => (
                          <Pill key={r} tone="marigold" dot={false}>
                            {r}
                          </Pill>
                        ))}
                      </div>
                    </div>
                    {isAdmin && (
                      <form action={setLeftOut}>
                        <input type="hidden" name="document" value={d.document_id} />
                        <input type="hidden" name="on" value="1" />
                        <button className={btn.secondary}>Leave out</button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
