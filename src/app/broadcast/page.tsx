import { CAMPAIGN, DEFAULT_TEST_PHONE, loadBroadcastPage, type BroadcastRow } from "@/lib/broadcast";
import { Card, Empty, Pill, Stat, table, type PillTone } from "@/components/ui";
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
        <div className="mb-4 flex gap-3 rounded-2xl border border-clay/20 bg-clay/[0.05] px-5 py-3.5 text-sm text-clay">
          <Icon name="alert" className="mt-0.5 size-4 shrink-0" />
          <p>{params.error}</p>
        </div>
      )}
      {params.queued && !params.error && (
        <div className="mb-4 flex gap-3 rounded-2xl border border-moss/20 bg-moss/[0.06] px-5 py-3.5 text-sm text-moss">
          <Icon name="check" className="mt-0.5 size-4 shrink-0" />
          <p>
            {params.queued === "test"
              ? "Test queued. It goes out within about 15 seconds — watch your phone and the history below."
              : "Queued for the whole waitlist. Progress shows below and updates by itself."}
          </p>
        </div>
      )}

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
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
            <Stat icon="users" label="On the waitlist" value={fmt(page.audience.data.people)} note="Not counting unsubscribed" />
            <Stat icon="message" label="Will get WhatsApp" value={fmt(page.audience.data.phones)} />
            <Stat icon="mail" label="Will get email" value={fmt(page.audience.data.emails)} />
          </>
        ) : (
          <div className="sm:col-span-1 xl:col-span-3">
            <Failed what="the waitlist" error={page.audience.error ?? "unknown"} />
          </div>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <Card title="What they will see" sub="Exactly as it will arrive" icon="message">
          {page.campaign ? (
            <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <WhatsAppPreview c={page.campaign} />
              <div>
                <p className="mb-2 text-xs font-medium tracking-wide text-ink/45 uppercase">Email</p>
                <p className="mb-2 text-sm">
                  <span className="text-ink/50">Subject:</span> <strong>{page.campaign.email.subject}</strong>
                </p>
                <iframe
                  title="Email preview"
                  srcDoc={page.campaign.email.html}
                  sandbox=""
                  className="h-[560px] w-full rounded-xl border border-line bg-[#f6f1e7]"
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
          <Card title="Send a test" sub="One person, through the real sender" icon="send">
            <form action={sendTest} className="space-y-3">
              <Field label="WhatsApp number" name="phone" defaultValue={DEFAULT_TEST_PHONE} placeholder="0810 740 8438" />
              <Field label="Email (optional)" name="email" type="email" placeholder="you@example.com" />
              {!approved && (
                <p className="rounded-xl bg-marigold/10 px-3.5 py-2.5 text-xs leading-relaxed text-[#7a5300]">
                  Until Meta approves the template, WhatsApp only lets Balans message a number that wrote to it in the last
                  24 hours. Send “hi” to Balans from this phone first, then press Send test.
                </p>
              )}
              <button
                type="submit"
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-ink px-4 text-sm font-medium text-cream transition-colors hover:bg-ink-3"
              >
                <Icon name="send" className="size-4" />
                Send test
              </button>
            </form>
          </Card>

          <Card title="Send to the waitlist" sub="Oldest sign-ups first, in as many batches as you like" icon="zap">
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
                  <span className="text-xs font-medium text-ink/55">How many (blank = everyone still waiting)</span>
                  <input
                    name="count"
                    type="number"
                    min={1}
                    inputMode="numeric"
                    placeholder={page.unsent === null ? "All" : `All ${fmt(page.unsent)}`}
                    disabled={!approved}
                    className="mt-1 h-10 w-full rounded-xl border border-line bg-white px-3 text-sm outline-none focus:border-ink/40 focus:ring-4 focus:ring-ink/5 disabled:bg-canvas"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-ink/55">Type SEND to confirm</span>
                  <input
                    name="confirm"
                    autoComplete="off"
                    disabled={!approved}
                    className="mt-1 h-10 w-full rounded-xl border border-line bg-white px-3 font-mono text-sm tracking-widest uppercase outline-none focus:border-ink/40 focus:ring-4 focus:ring-ink/5 disabled:bg-canvas"
                  />
                </label>
                <button
                  type="submit"
                  disabled={!approved}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-marigold px-4 text-sm font-semibold text-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
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
        <Card title="History" sub="Tests and sends, newest first" icon="clock" flush>
          {page.history.error ? (
            <div className="px-5 pb-5">
              <Failed what="broadcasts" error={page.history.error} />
            </div>
          ) : history.length === 0 ? (
            <div className="border-t border-line">
              <Empty icon="send">Nothing sent yet.</Empty>
            </div>
          ) : (
            <div className={table.wrap}>
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
          )}
        </Card>
      </div>
    </Shell>
  );
}

function HistoryRow({ b }: { b: BroadcastRow }) {
  const tone: Record<BroadcastRow["status"], PillTone> = {
    queued: "marigold",
    sending: "marigold",
    done: "moss",
    failed: "clay",
    cancelled: "neutral",
  };
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
        <Pill tone={tone[b.status]}>{title(b.status)}</Pill>
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
      <p className="mb-2 text-xs font-medium tracking-wide text-ink/45 uppercase">WhatsApp</p>
      <div className="rounded-2xl bg-[#efe7dd] p-4 sm:p-5">
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
      <p className="mt-2 text-xs text-ink/45">Template: {CAMPAIGN}</p>
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
      <span className="text-xs font-medium text-ink/55">{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="mt-1 h-10 w-full rounded-xl border border-line bg-white px-3 text-sm outline-none placeholder:text-ink/35 focus:border-ink/40 focus:ring-4 focus:ring-ink/5"
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
