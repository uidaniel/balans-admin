import { CAMPAIGN, DEFAULT_TEST_PHONE, loadBroadcastPage, type BroadcastRow } from "@/lib/broadcast";
import { Card, Empty, Notice, Pill, Stat, btn, field, table, type PillTone } from "@/components/ui";
import { Icon } from "@/components/icons";
import { Failed, gate, Shell } from "../shell";
import { sendTest, sendToEveryone } from "./actions";
import { RefreshWhile } from "./refresh";

export const dynamic = "force-dynamic";

/**
 * The launch message: what it looks like, a test to your own phone, and the
 * send to everyone on the waitlist.
 *
 * The preview is drawn from the copy the API publishes, so it is the message,
 * not a picture of it. The test goes through the same sender as the real
 * thing, with one recipient.
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
  // Everyone has had it: nothing left to send (sent in batches, oldest first).
  const alreadySent = page.unsent === 0;
  const isAdmin = g.staff.role === "admin";

  return (
    <Shell
      email={g.staff.email}
      current="/broadcast"
      title="Broadcast"
      sub="The “we're live” message to the waitlist, on WhatsApp and by email. Test it on your own phone first."
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
            ? "Test queued. It goes out within about 15 seconds — watch your phone and the history below."
            : "Queued for the whole waitlist. Progress shows below and updates by itself."}
        </Notice>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Stat
          className="col-span-2 xl:col-span-1"
          icon="shield"
          label="WhatsApp template"
          value={page.templateStatus ? title(page.templateStatus) : "Unknown"}
          tone={approved ? "moss" : page.templateStatus === "REJECTED" ? "clay" : undefined}
          note={
            approved
              ? "Meta approved it. It can reach anyone on the list."
              : "Waiting on Meta. Until then a test only reaches a phone that messaged Balans in the last 24 hours."
          }
        />
        {page.audience.data ? (
          <>
            <Stat className="col-span-2 xl:col-span-1" icon="users" label="On the waitlist" value={fmt(page.audience.data.people)} note="Not counting unsubscribed" />
            <Stat icon="message" label="Will get WhatsApp" value={fmt(page.audience.data.phones)} />
            <Stat icon="mail" label="Will get email" value={fmt(page.audience.data.emails)} />
          </>
        ) : (
          <div className="col-span-2 xl:col-span-3">
            <Failed what="the waitlist" error={page.audience.error ?? "unknown"} />
          </div>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <Card title="What they will see" sub="Exactly as it will arrive">
          {page.campaign ? (
            <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <WhatsAppPreview c={page.campaign} />
              <div>
                <p className="mb-2 text-[0.82rem] font-medium text-ink/60">Email</p>
                <p className="mb-2 text-sm">
                  <span className="text-ink/50">Subject:</span> <strong className="font-medium">{page.campaign.email.subject}</strong>
                </p>
                <iframe
                  title="Email preview"
                  srcDoc={page.campaign.email.html}
                  sandbox=""
                  className="h-[520px] w-full rounded-2xl border border-line bg-cream sm:h-[560px]"
                />
              </div>
            </div>
          ) : (
            <Empty icon="message">
              The API has not published the campaign yet. It does that when it starts — this appears after its next deploy.
            </Empty>
          )}
        </Card>

        <div className="flex flex-col gap-4">
          <Card title="Send a test" sub="One person, through the real sender">
            <form action={sendTest} className="space-y-3">
              <Field label="WhatsApp number" name="phone" defaultValue={DEFAULT_TEST_PHONE} placeholder="0810 740 8438" />
              <Field label="Email (optional)" name="email" type="email" placeholder="you@example.com" />
              {!approved && (
                <p className="rounded-2xl bg-[#fdf3dc] px-3.5 py-2.5 text-xs leading-relaxed text-[#6b4800]">
                  Until Meta approves the template, WhatsApp only lets Balans message a number that wrote to it in the last
                  24 hours. Send “hi” to Balans from this phone first, then press Send test.
                </p>
              )}
              <button type="submit" className={btn.primary}>
                <Icon name="send" className="size-4 text-marigold" />
                Send test
              </button>
            </form>
          </Card>

          <Card title="Send to the waitlist" sub="Oldest sign-ups first, in as many batches as you like">
            {alreadySent ? (
              <p className="text-sm leading-relaxed text-ink/65">
                Everyone on the waitlist has had this — see the history below. Nobody is ever sent it twice.
              </p>
            ) : !isAdmin ? (
              <p className="text-sm text-ink/65">Only an admin can send to the whole waitlist.</p>
            ) : (
              <form action={sendToEveryone} className="space-y-3">
                <p className="text-sm leading-relaxed text-ink/65">
                  {page.unsent === null ? "Some people" : fmt(page.unsent)} of{" "}
                  {page.audience.data ? fmt(page.audience.data.people) : "the waitlist"} have not had it yet. It goes to the
                  earliest sign-ups first: WhatsApp to each number, email to each address. Nobody already sent to is sent
                  it again. This cannot be undone.
                </p>
                <label className="block">
                  <span className="text-[0.82rem] font-medium text-ink/60">How many (blank = everyone still waiting)</span>
                  <input
                    name="count"
                    type="number"
                    min={1}
                    inputMode="numeric"
                    placeholder={page.unsent === null ? "All" : `All ${fmt(page.unsent)}`}
                    disabled={!approved}
                    className={`mt-1.5 ${field}`}
                  />
                </label>
                <label className="block">
                  <span className="text-[0.82rem] font-medium text-ink/60">Type SEND to confirm</span>
                  <input
                    name="confirm"
                    autoComplete="off"
                    disabled={!approved}
                    className={`mt-1.5 font-mono tracking-widest uppercase ${field}`}
                  />
                </label>
                <button type="submit" disabled={!approved} className={btn.accent}>
                  <Icon name="zap" className="size-4" />
                  Send
                </button>
                {!approved && (
                  <p className="text-xs text-ink/50">Unlocks when Meta approves the template. This page checks every few minutes.</p>
                )}
              </form>
            )}
          </Card>
        </div>
      </div>

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
          {b.kind === "live" ? "Waitlist" : "Test"}
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
          {b.kind === "live" ? "Waitlist" : "Test"}
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

/** A WhatsApp message bubble: header image, body with *bold*, footer, one link button. */
function WhatsAppPreview({ c }: { c: NonNullable<Awaited<ReturnType<typeof loadBroadcastPage>>["campaign"]> }) {
  return (
    <div>
      <p className="mb-2 text-[0.82rem] font-medium text-ink/60">WhatsApp</p>
      <div className="rounded-[20px] bg-[#efe7dd] p-3 sm:p-5">
        <div className="max-w-[340px] overflow-hidden rounded-xl rounded-tl-sm bg-white shadow-[0_1px_1px_rgba(0,0,0,0.12)]">
          <div className="p-1">
            {/* eslint-disable-next-line @next/next/no-img-element -- the published poster, exactly as sent */}
            <img src={c.image} alt="The launch poster" className="block w-full rounded-lg" />
          </div>
          <div className="px-2.5 pt-1.5 pb-1 text-[0.9rem] leading-snug whitespace-pre-wrap text-[#111b21]">
            {bold(c.whatsapp.body)}
          </div>
          <div className="flex items-end justify-between gap-2 px-2.5 pb-1.5">
            <p className="text-[0.78rem] text-[#667781]">{c.whatsapp.footer}</p>
            <p className="shrink-0 text-[0.68rem] text-[#667781]">{lagosTime()}</p>
          </div>
          <p className="flex items-center justify-center gap-1.5 border-t border-[#e9edef] py-2.5 text-[0.9rem] font-medium text-[#0a7cff]">
            <Icon name="file" className="size-4" />
            {c.whatsapp.button}
          </p>
        </div>
        <p className="mt-3 text-xs text-ink/45">Button opens: {c.whatsapp.opens}</p>
      </div>
      <p className="mt-2 text-xs text-ink/45">
        Template: <span className="font-mono">{CAMPAIGN}</span>
      </p>
    </div>
  );
}

function bold(text: string): React.ReactNode[] {
  return text.split(/(\*[^*\n]+\*)/g).map((part, i) =>
    part.startsWith("*") && part.endsWith("*") && part.length > 2 ? <strong key={i}>{part.slice(1, -1)}</strong> : part,
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

function lagosTime(): string {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" }).format(
    new Date(),
  );
}
