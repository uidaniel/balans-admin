import Link from "next/link";
import { naira, shortDate } from "@/lib/money";
import { serviceClient } from "@/lib/supabase";
import { sourceLabel, type Account } from "@/lib/dashboard";
import { Card, Empty, Notice, Pill, Stat, btn, field, statGrid, table, type PillTone } from "@/components/ui";
import { Icon } from "@/components/icons";
import { Failed, gate, Shell } from "../../shell";
import { revealClient } from "./actions";
import { REASONS, SHOWN_FOR_MS, reasonLabel } from "./reasons";

export const dynamic = "force-dynamic";

/*
 * One user: their account, their documents and their clients (3 November 2026).
 *
 * Admins only, and only for a reason the privacy notice names: to help the
 * user, fix a fault, settle a dispute or keep Balans secure. Opening the page
 * is logged; clients' phone numbers and emails are masked on the server and
 * shown only after a logged reveal (./actions.ts). The log is at the bottom,
 * so whoever looks can see who looked before them.
 *
 * Deliberately no link to the client's invoice page: opening it marks the
 * invoice "opened" and tells the user their client has seen it.
 */

type User = {
  id: string;
  wa_phone: string;
  business_name: string | null;
  email: string | null;
  email_verified_at: string | null;
  plan: string;
  plan_expires_at: string | null;
  status: string;
  created_at: string;
  consented_at: string | null;
  signup_source: string | null;
  signup_detail: string | null;
};

type Doc = {
  id: string;
  client_id: string | null;
  type: string;
  number: number;
  ref: string | null;
  title: string | null;
  status: string;
  currency: string;
  total_kobo: number;
  amount_paid_kobo: number;
  due_date: string | null;
  sent_at: string | null;
  created_at: string;
};

type Client = { id: string; name: string; email: string | null; phone: string | null; created_at: string };

type Logged = { id: string; actor_id: string | null; action: string; target_type: string | null; target_id: string | null; after_json: Record<string, unknown> | null; created_at: string };

const TYPE: Record<string, string> = { invoice: "Invoice", quote: "Quote", payment_request: "Request", receipt: "Receipt" };

const STATUS: Record<string, { label: string; tone: PillTone }> = {
  draft: { label: "Draft", tone: "neutral" },
  sent: { label: "Sent", tone: "neutral" },
  viewed: { label: "Opened", tone: "marigold" },
  overdue: { label: "Overdue", tone: "clay" },
  part_paid: { label: "Part paid", tone: "marigold" },
  paid: { label: "Paid", tone: "moss" },
  cancelled: { label: "Cancelled", tone: "neutral" },
  accepted: { label: "Accepted", tone: "moss" },
  converted: { label: "Converted", tone: "moss" },
  expired: { label: "Expired", tone: "neutral" },
};

const ACTION: Record<string, string> = {
  "user.view": "Opened this page",
  "client.reveal": "Saw a client's details",
  "plan.promote": "Moved to Pro",
  "plan.demote": "Moved to Free",
};

export default async function UserPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ shown?: string; reveal_error?: string }>;
}) {
  const g = await gate();
  if (!g.staff) return g.stop;
  const staff = g.staff;
  const { id } = await params;
  const { shown, reveal_error } = await searchParams;

  if (staff.role !== "admin") {
    return (
      <Shell email={staff.email} current="/users" title="User" sub="Admins only">
        <Card>
          <Empty icon="shield">Only an admin can open a user&apos;s documents and clients.</Empty>
        </Card>
      </Shell>
    );
  }
  if (!/^[0-9a-f-]{36}$/i.test(id)) return <Missing email={staff.email} />;

  const db = serviceClient();
  const { data: user, error } = await db
    .from("users")
    .select(
      "id, wa_phone, business_name, email, email_verified_at, plan, plan_expires_at, status, created_at, consented_at, signup_source, signup_detail",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle<User>();
  if (error) {
    return (
      <Shell email={staff.email} current="/users" title="User">
        <Failed what="this user" error={error.message} />
      </Shell>
    );
  }
  if (!user) return <Missing email={staff.email} />;

  await logView(staff.email, user.id);

  const [account, docs, clients] = await Promise.all([
    db.from("admin_accounts").select("*").eq("id", id).maybeSingle<Account>(),
    db
      .from("documents")
      .select("id, client_id, type, number, ref, title, status, currency, total_kobo, amount_paid_kobo, due_date, sent_at, created_at")
      .eq("user_id", id)
      .neq("type", "sample")
      .order("created_at", { ascending: false })
      .limit(100)
      .returns<Doc[]>(),
    db
      .from("clients")
      .select("id, name, email, phone, created_at")
      .eq("user_id", id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .returns<Client[]>(),
  ]);

  const clientIds = (clients.data ?? []).map((c) => c.id);
  const [aboutUser, aboutClients, revealed] = await Promise.all([
    db.from("audit_log").select("id, actor_id, action, target_type, target_id, after_json, created_at").eq("target_type", "user").eq("target_id", id).order("created_at", { ascending: false }).limit(25).returns<Logged[]>(),
    clientIds.length
      ? db.from("audit_log").select("id, actor_id, action, target_type, target_id, after_json, created_at").eq("target_type", "client").in("target_id", clientIds).order("created_at", { ascending: false }).limit(25).returns<Logged[]>()
      : Promise.resolve({ data: [] as Logged[] }),
    // The details are shown only against a fresh reveal by this same person.
    shown && clientIds.includes(shown)
      ? db
          .from("audit_log")
          .select("id")
          .eq("action", "client.reveal")
          .eq("actor_id", staff.email)
          .eq("target_id", shown)
          .gte("created_at", since(SHOWN_FOR_MS))
          .limit(1)
      : Promise.resolve({ data: [] as { id: string }[] }),
  ]);
  const open = (revealed.data ?? []).length > 0 ? shown! : null;
  const log = [...(aboutUser.data ?? []), ...(aboutClients.data ?? [])]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 25);

  const a = account.data;
  const name = user.business_name ?? `+${user.wa_phone}`;
  const clientName = new Map((clients.data ?? []).map((c) => [c.id, c.name]));
  const docsPerClient = new Map<string, number>();
  for (const d of docs.data ?? []) if (d.client_id) docsPerClient.set(d.client_id, (docsPerClient.get(d.client_id) ?? 0) + 1);

  return (
    <Shell
      email={staff.email}
      current="/users"
      title={name}
      sub={`+${user.wa_phone} · joined ${shortDate(user.created_at)} · via ${sourceLabel(user.signup_source, user.signup_detail)}`}
    >
      <div className="mb-4">
        <Link href="/users" className="inline-flex items-center gap-1.5 text-sm text-ink/55 hover:text-ink">
          <Icon name="arrowRight" className="size-3.5 rotate-180" />
          All users
        </Link>
      </div>

      <Notice tone="marigold" className="mb-4" title="Only for a reason">
        Open a user&apos;s documents and clients only to help them, fix a fault, settle a dispute or keep Balans secure.
        This visit is logged, and so is every client whose details you show.
      </Notice>

      <div className={statGrid}>
        <Stat
          icon="zap"
          label="Plan"
          value={user.plan === "pro" ? "Pro" : "Free"}
          note={user.plan === "pro" ? (user.plan_expires_at ? `Until ${shortDate(user.plan_expires_at)}` : "No end date") : undefined}
        />
        <Stat icon="file" label="Invoiced" value={naira(a?.invoiced_kobo ?? 0)} note={`${a?.invoices ?? 0} invoices · ${a?.invoices_paid ?? 0} paid`} />
        <Stat icon="wallet" label="Collected" value={naira(a?.collected_kobo ?? 0)} />
        <Stat
          icon="alert"
          label="Outstanding"
          value={naira(a?.outstanding_kobo ?? 0)}
          tone={(a?.outstanding_kobo ?? 0) > 0 ? "clay" : undefined}
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card title="Account">
          <dl className="space-y-3 text-sm">
            <Row k="WhatsApp" v={`+${user.wa_phone}`} mono />
            <Row k="Email" v={user.email ? `${user.email}${user.email_verified_at ? "" : " (unconfirmed)"}` : "—"} />
            <Row k="Finished setup" v={user.consented_at ? shortDate(user.consented_at) : "Not yet"} />
            <Row k="Last active" v={a?.last_active_at ? shortDate(a.last_active_at) : "—"} />
            <Row k="Status" v={user.status} />
          </dl>
        </Card>

        <Card className="xl:col-span-2" title="Documents" sub="Newest first, up to 100" flush>
          {docs.error ? (
            <div className="p-4 sm:p-5">
              <Failed what="documents" error={docs.error.message} />
            </div>
          ) : !docs.data?.length ? (
            <Empty icon="file">No documents yet.</Empty>
          ) : (
            <div className={table.wrap}>
              <table className={`${table.table} min-w-160`}>
                <thead className={table.head}>
                  <tr>
                    <th className={table.th}>Document</th>
                    <th className={table.th}>Client</th>
                    <th className={table.th}>Status</th>
                    <th className={table.th}>Sent</th>
                    <th className={table.th}>Due</th>
                    <th className={`${table.th} text-right`}>Amount</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {docs.data.map((d) => {
                    const s = STATUS[d.status] ?? { label: d.status, tone: "neutral" as PillTone };
                    return (
                      <tr key={d.id} className={table.row}>
                        <td className={table.td}>
                          <p className="font-medium whitespace-nowrap">{d.ref ?? `${TYPE[d.type] ?? d.type} ${d.number}`}</p>
                          <p className="max-w-56 truncate text-xs text-ink/50">{d.title ?? TYPE[d.type] ?? d.type}</p>
                        </td>
                        <td className={`${table.td} max-w-48 truncate`}>{d.client_id ? (clientName.get(d.client_id) ?? "Removed client") : "—"}</td>
                        <td className={table.td}>
                          <Pill tone={s.tone}>{s.label}</Pill>
                        </td>
                        <td className={`${table.td} whitespace-nowrap text-ink/60`}>{d.sent_at ? shortDate(d.sent_at) : "—"}</td>
                        <td className={`${table.td} whitespace-nowrap text-ink/60`}>{d.due_date ? shortDate(d.due_date) : "—"}</td>
                        <td className={`${table.td} text-right`}>
                          <p className="font-medium">{money(d.total_kobo, d.currency)}</p>
                          {d.amount_paid_kobo > 0 && d.amount_paid_kobo < d.total_kobo && (
                            <p className="text-xs text-moss">{money(d.amount_paid_kobo, d.currency)} paid</p>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <div id="clients" className="scroll-mt-24">
        <Card
          className="mt-4"
          title="Clients"
          sub="Names in full; phone numbers and emails only after you say why, and that is logged"
          flush
        >
          {reveal_error && (
            <div className="px-4 pt-4 sm:px-5">
              <Notice tone="clay" title="Not shown">
                {reveal_error}
              </Notice>
            </div>
          )}
          {clients.error ? (
            <div className="p-4 sm:p-5">
              <Failed what="clients" error={clients.error.message} />
            </div>
          ) : !clients.data?.length ? (
            <Empty icon="users">No clients saved.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {clients.data.map((c) => {
                const isOpen = open === c.id;
                return (
                  <li key={c.id} className="flex flex-col gap-3 px-4 py-3.5 sm:px-5 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{c.name}</p>
                      <p className="mt-0.5 text-xs text-ink/55">
                        <span className="font-mono">{c.phone ? (isOpen ? c.phone : maskPhone(c.phone)) : "No WhatsApp"}</span>
                        {" · "}
                        {c.email ? (isOpen ? c.email : maskEmail(c.email)) : "No email"}
                        {" · "}
                        {docsPerClient.get(c.id) ?? 0} document{docsPerClient.get(c.id) === 1 ? "" : "s"}
                      </p>
                      {isOpen && <p className="mt-1 text-xs text-clay">Shown to you for 15 minutes. This was logged.</p>}
                    </div>
                    {!isOpen && (c.phone || c.email) && (
                      <form action={revealClient} className="flex shrink-0 flex-wrap items-center gap-2">
                        <input type="hidden" name="user" value={user.id} />
                        <input type="hidden" name="client" value={c.id} />
                        <select name="reason" required defaultValue="" className={`${field} h-9 w-auto text-sm`} aria-label="Why you need to see them">
                          <option value="" disabled>
                            Why?
                          </option>
                          {REASONS.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                        <input name="note" maxLength={200} placeholder="Note (optional)" className={`${field} h-9 w-44 text-sm`} />
                        <button type="submit" className={btn.secondary}>
                          Show details
                        </button>
                      </form>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-4" title="Who looked" sub="Every visit to this page, every client shown, and plan changes" flush>
        {!log.length ? (
          <Empty icon="shield">Nothing logged yet.</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {log.map((l) => (
              <li key={l.id} className="flex items-baseline justify-between gap-3 px-4 py-2.5 text-sm sm:px-5">
                <span className="min-w-0">
                  <span className="font-medium">{l.actor_id ?? "System"}</span>{" "}
                  <span className="text-ink/60">
                    {ACTION[l.action] ?? l.action}
                    {l.action === "client.reveal" && (
                      <>
                        {" "}
                        ({l.target_id ? (clientName.get(l.target_id) ?? "a client") : "a client"}): {reasonLabel(l.after_json?.reason)}
                        {l.after_json?.note ? ` · “${String(l.after_json.note)}”` : ""}
                      </>
                    )}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-ink/45 tabular-nums">{when(l.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </Shell>
  );
}

function Missing({ email }: { email: string }) {
  return (
    <Shell email={email} current="/users" title="User">
      <Card>
        <Empty icon="users">No such user.</Empty>
      </Card>
    </Shell>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-ink/55">{k}</dt>
      <dd className={`min-w-0 truncate text-right ${mono ? "font-mono text-[0.82rem]" : ""}`}>{v}</dd>
    </div>
  );
}

/**
 * One row per visit, but not one per refresh: a second look by the same
 * person within half an hour is the same visit.
 */
async function logView(staffEmail: string, userId: string): Promise<void> {
  const db = serviceClient();
  const { data } = await db
    .from("audit_log")
    .select("id")
    .eq("action", "user.view")
    .eq("actor_id", staffEmail)
    .eq("target_id", userId)
    .gte("created_at", since(30 * 60_000))
    .limit(1);
  if (data?.length) return;
  await db.from("audit_log").insert({ actor_type: "staff", actor_id: staffEmail, action: "user.view", target_type: "user", target_id: userId });
}

/** "+234 803 ••• 4521": enough to tell two clients apart, not enough to call. */
function maskPhone(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.length < 7) return "•••";
  const cc = d.startsWith("234") ? "+234 " : phone.trim().startsWith("+") ? "+" : "";
  const rest = d.startsWith("234") ? d.slice(3) : d;
  return `${cc}${rest.slice(0, 3)} ••• ${rest.slice(-4)}`;
}

/** "a•••@gmail.com". */
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "•••";
  return `${local!.slice(0, 1)}•••@${domain}`;
}

/** In the document's own currency: minor units, as every amount is stored. */
function money(minor: number, currency: string): string {
  if (currency === "NGN") return naira(minor);
  try {
    return new Intl.NumberFormat("en-NG", { style: "currency", currency }).format(minor / 100);
  } catch {
    return `${currency} ${(minor / 100).toFixed(2)}`;
  }
}

/** The moment `ms` ago, for a "since" filter. */
const since = (ms: number): string => new Date(Date.now() - ms).toISOString();

const when = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Lagos",
  }).format(new Date(iso));
