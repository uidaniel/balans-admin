import { DEFAULT_TEST_PHONE, MAX_MESSAGE, loadBroadcastPage, type BroadcastRow } from "@/lib/broadcast";
import { Card, Empty, Notice, Pill, Stat, btn, field, table, type PillTone } from "@/components/ui";
import { Icon } from "@/components/icons";
import { Failed, gate, Shell } from "../shell";
import { sendTest, sendToEveryone } from "./actions";
import { RefreshWhile } from "./refresh";

export const dynamic = "force-dynamic";

/**
 * A message to every user, on WhatsApp and by email (3 November 2026). The
 * waitlist's launch message is retired: Balans is live.
 *
 * One form: write it, test it on your own phone, then send it to everybody,
 * typed SEND to confirm. The API does the sending (see lib/broadcast.ts).
 */
export default async function BroadcastPage({
  searchParams,
}: {
  searchParams: Promise<{ queued?: string; error?: string }>;
}) {
  const g = await gate();
  if (!g.staff) return g.stop;

  const params = await searchParams;
  const page = await loadBroadcastPage();
  const history = page.history.data ?? [];
  const approved = page.templateStatus === "APPROVED";
  const busy = history.some((b) => b.status === "queued" || b.status === "sending");
  const isAdmin = g.staff.role === "admin";

  return (
    <Shell
      email={g.staff.email}
      current="/broadcast"
      title="Broadcast"
      sub="A message to every user, on WhatsApp and by email. Test it on your own phone first."
    >
      <RefreshWhile active={busy} />

      {params.error && (
        <Notice tone="clay" role="alert" className="mb-4">
          {params.error}
        </Notice>
      )}
      {params.queued && !params.error && (
        <Notice tone="moss" role="status" className="mb-4">
          {params.queued === "test"
            ? "Test queued. It goes out within about 15 seconds: watch your phone and the history below."
            : "Queued for every user. Progress shows below and updates by itself."}
        </Notice>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
        <Stat
          className="col-span-2 xl:col-span-1"
          icon="shield"
          label="WhatsApp template"
          value={page.templateStatus ? title(page.templateStatus) : "Not submitted yet"}
          tone={approved ? "moss" : page.templateStatus === "REJECTED" ? "clay" : undefined}
          note={
            approved
              ? "Approved: reaches everyone, in or out of a chat."
              : "Until Meta approves it, WhatsApp reaches only people who messaged Balans in the last 24 hours."
          }
        />
        {page.audience.data ? (
          <>
            <Stat icon="users" label="Will get WhatsApp" value={fmt(page.audience.data.people)} note="Said yes to updates, and not since said stop" />
            <Stat icon="mail" label="Will get email" value={fmt(page.audience.data.emails)} note="Confirmed addresses only" />
          </>
        ) : (
          <div className="col-span-2">
            <Failed what="the audience" error={page.audience.error ?? "unknown"} />
          </div>
        )}
      </div>

      {!isAdmin ? (
        <Card title="Write a message">
          <p className="text-sm text-ink/65">Only an admin can send messages to users.</p>
        </Card>
      ) : (
        <form className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <Card title="Write a message" sub="Plain words. WhatsApp adds “Reply STOP UPDATES”; email adds an unsubscribe link">
            <div className="space-y-3">
              <Field label="Email subject" name="subject" placeholder="What's new on Balans" />
              <label className="block">
                <span className="text-[0.82rem] font-medium text-ink/60">Message</span>
                <textarea
                  name="message"
                  required
                  maxLength={MAX_MESSAGE}
                  rows={7}
                  placeholder="Balans now sends a summary of your month on the 1st…"
                  className={`mt-1.5 ${field} h-auto py-3 leading-relaxed`}
                />
                <span className="mt-1 block text-xs text-ink/45">
                  Up to {MAX_MESSAGE} characters. Outside a 24-hour chat WhatsApp sends it as one paragraph, through the
                  approved template; email keeps your paragraphs.
                </span>
              </label>
              <fieldset className="flex flex-wrap gap-4 pt-1 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="whatsapp" defaultChecked className="size-4 accent-[#10231c]" /> WhatsApp
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="email" defaultChecked className="size-4 accent-[#10231c]" /> Email
                </label>
              </fieldset>
            </div>
          </Card>

          <div className="flex flex-col gap-4">
            <Card title="Send a test" sub="To you, through the real sender">
              <div className="space-y-3">
                <Field label="WhatsApp number" name="phone" defaultValue={DEFAULT_TEST_PHONE} placeholder="0810 740 8438" />
                <Field label="Email (optional)" name="email_to" type="email" placeholder="you@example.com" />
                <button type="submit" formAction={sendTest} className={btn.primary}>
                  <Icon name="send" className="size-4 text-marigold" />
                  Send test
                </button>
              </div>
            </Card>

            <Card title="Send to every user" sub="Everyone who finished setup and has not opted out">
              <div className="space-y-3">
                <p className="text-sm leading-relaxed text-ink/65">
                  {page.audience.data ? `${fmt(page.audience.data.people)} people` : "Every user"} on WhatsApp
                  {page.audience.data ? `, ${fmt(page.audience.data.emails)} by email` : ""}. Outside a 24-hour chat WhatsApp
                  charges a marketing rate per message. This cannot be undone.
                </p>
                <label className="block">
                  <span className="text-[0.82rem] font-medium text-ink/60">Type SEND to confirm</span>
                  <input name="confirm" autoComplete="off" className={`mt-1.5 font-mono tracking-widest uppercase ${field}`} />
                </label>
                <button type="submit" formAction={sendToEveryone} className={btn.accent}>
                  <Icon name="zap" className="size-4" />
                  Send to everyone
                </button>
              </div>
            </Card>
          </div>
        </form>
      )}

      <div className="mt-4">
        <Card title="History" sub="Tests and sends, newest first" flush>
          {page.history.error ? (
            <div className="px-4 pb-4 sm:px-5 sm:pb-5">
              <Failed what="broadcasts" error={page.history.error} />
            </div>
          ) : history.length === 0 ? (
            <div className="border-t border-line">
              <Empty icon="send">Nothing sent yet.</Empty>
            </div>
          ) : (
            <>
            <ul className={`${table.list} lg:hidden`}>
              {history.map((b) => (
                <HistoryCard key={b.id} b={b} />
              ))}
            </ul>
            <div className={`${table.wrap} hidden lg:block`}>
              <table className={`${table.table} min-w-240`}>
                <thead className={table.head}>
                  <tr>
                    <th className={table.th}>When</th>
                    <th className={table.th}>Kind</th>
                    <th className={table.th}>Status</th>
                    <th className={table.th}>To</th>
                    <th className={`${table.th} text-right`}>WhatsApp</th>
                    <th className={`${table.th} text-right`}>Email</th>
                    <th className={table.th}>What came back</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {history.map((b) => (
                    <HistoryRow key={b.id} b={b} />
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}
        </Card>
      </div>
    </Shell>
  );
}

const TONE: Record<BroadcastRow["status"], PillTone> = {
  queued: "marigold",
  sending: "marigold",
  done: "moss",
  failed: "clay",
  cancelled: "neutral",
};

/** A send, as a card for the phone list. */
function HistoryCard({ b }: { b: BroadcastRow }) {
  const problem = b.note ?? b.wa_error ?? b.email_error;
  return (
    <li className={table.item}>
      <div className="flex flex-wrap items-center gap-1.5">
        <Pill tone={b.kind === "live" ? "ink" : "neutral"} dot={false}>
          {b.kind === "live" ? "All users" : "Test"}
        </Pill>
        <Pill tone={TONE[b.status]}>{title(b.status)}</Pill>
        <span className="ml-auto text-xs text-ink/45 tabular-nums">{when(b.created_at)}</span>
      </div>
      <div className="mt-2 text-sm">
        {b.kind === "test" ? (
          <>
            {b.first_phone && <p className="font-mono text-[0.82rem]">{b.first_phone}</p>}
            {b.first_email && <p className="truncate text-xs text-ink/55">{b.first_email}</p>}
          </>
        ) : (
          <p className="font-medium tabular-nums">{fmt(b.recipients)} people</p>
        )}
      </div>
      <dl className="mt-2.5 grid grid-cols-2 gap-2 rounded-2xl bg-paper px-3 py-2.5 text-xs tabular-nums">
        <div className="min-w-0">
          <dt className="text-ink/45">WhatsApp</dt>
          <dd className="mt-0.5">
            <Counts sent={b.wa_sent} failed={b.wa_failed} pending={b.wa_pending} />
            {b.wa_via === "preview" && <p className="text-ink/45">as a preview</p>}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-ink/45">Email</dt>
          <dd className="mt-0.5">
            <Counts sent={b.email_sent} failed={b.email_failed} pending={b.email_pending} />
          </dd>
        </div>
      </dl>
      <p className={`mt-2 text-xs leading-relaxed break-words ${problem ? "text-clay" : "text-ink/45"}`}>
        {problem ?? (b.status === "done" ? "All delivered to WhatsApp and the mail server." : "—")}
      </p>
      {b.created_by && <p className="mt-1 text-[0.7rem] text-ink/40">By {b.created_by}</p>}
    </li>
  );
}

function HistoryRow({ b }: { b: BroadcastRow }) {
  const problem = b.note ?? b.wa_error ?? b.email_error;
  return (
    <tr className={table.row}>
      <td className={`${table.td} whitespace-nowrap`}>
        <p>{when(b.created_at)}</p>
        <p className="text-xs text-ink/45">{b.created_by ?? "—"}</p>
      </td>
      <td className={table.td}>
        <Pill tone={b.kind === "live" ? "ink" : "neutral"} dot={false}>
          {b.kind === "live" ? "All users" : "Test"}
        </Pill>
      </td>
      <td className={table.td}>
        <Pill tone={TONE[b.status]}>{title(b.status)}</Pill>
      </td>
      <td className={`${table.td} text-xs`}>
        {b.kind === "test" ? (
          <>
            {b.first_phone && <p className="font-mono">{b.first_phone}</p>}
            {b.first_email && <p className="text-ink/55">{b.first_email}</p>}
          </>
        ) : (
          <p>{fmt(b.recipients)} people</p>
        )}
      </td>
      <td className={`${table.td} text-right text-xs whitespace-nowrap`}>
        <Counts sent={b.wa_sent} failed={b.wa_failed} pending={b.wa_pending} />
        {b.wa_via === "preview" && <p className="text-ink/45">as a preview</p>}
      </td>
      <td className={`${table.td} text-right text-xs whitespace-nowrap`}>
        <Counts sent={b.email_sent} failed={b.email_failed} pending={b.email_pending} />
      </td>
      <td className={`${table.td} max-w-md text-xs leading-relaxed ${problem ? "text-clay" : "text-ink/45"}`}>
        {problem ?? (b.status === "done" ? "All delivered to WhatsApp and the mail server." : "—")}
      </td>
    </tr>
  );
}

function Counts({ sent, failed, pending }: { sent: number; failed: number; pending: number }) {
  if (!sent && !failed && !pending) return <span className="text-ink/35">—</span>;
  return (
    <p>
      <span className="font-medium text-moss">{fmt(sent)} sent</span>
      {failed > 0 && <span className="text-clay"> · {fmt(failed)} failed</span>}
      {pending > 0 && <span className="text-ink/50"> · {fmt(pending)} to go</span>}
    </p>
  );
}

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-[0.82rem] font-medium text-ink/60">{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className={`mt-1.5 ${field}`}
      />
    </label>
  );
}

const fmt = (n: number) => n.toLocaleString("en-NG");
const title = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ");

function when(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Lagos",
  }).format(new Date(iso));
}
