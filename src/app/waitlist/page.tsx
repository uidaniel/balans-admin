import { serviceClient } from "@/lib/supabase";
import { storageMode } from "@/lib/waitlist";
import { WaitlistTable, type Row } from "../waitlist-table";
import { Failed, gate, Shell } from "../shell";
import { Stat } from "@/components/ui";
import { Icon } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function WaitlistPage() {
  const g = await gate();
  if (!g.staff) return g.stop;

  const { rows, counts, error } = await loadWaitlist();

  return (
    <Shell
      email={g.staff.email}
      current="/waitlist"
      title="Waitlist"
      sub="Everyone who has asked to be let in."
      actions={
        <a
          href="/export"
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-ink px-4 text-sm font-medium text-cream transition-colors hover:bg-ink-3"
        >
          <Icon name="download" className="size-4 text-marigold" />
          Export CSV
        </a>
      }
    >
      {storageMode() === "file" && (
        <p className="mb-6 rounded-2xl border border-marigold/40 bg-marigold/10 px-5 py-4 text-sm leading-relaxed">
          <strong className="font-semibold">Signups are going to a local file.</strong> SUPABASE_SERVICE_ROLE_KEY is
          not set on this deployment, so the form is writing to
          <code className="mx-1 rounded bg-ink/10 px-1.5 py-0.5 text-[0.85em]">.waitlist.jsonl</code>
          instead of the table below. On a serverless host that write fails and the address is lost.
        </p>
      )}

      {error ? (
        <Failed what="the waitlist" error={error.message} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat icon="users" label="On the list" value={counts.total.toLocaleString("en-NG")} />
            <Stat icon="userPlus" label="Joined today" value={counts.today.toLocaleString("en-NG")} note="Since midnight, Lagos" />
            <Stat
              icon="message"
              label="Told us more"
              value={counts.answered.toLocaleString("en-NG")}
              note={counts.total ? `${Math.round((100 * counts.answered) / counts.total)}% answered step two` : undefined}
            />
            <Stat
              icon="send"
              label="Invited"
              value={counts.invited.toLocaleString("en-NG")}
              note={counts.total ? `${Math.round((100 * counts.invited) / counts.total)}% of the list` : undefined}
              tone="moss"
            />
          </div>
          <div className="mt-4">
            <WaitlistTable rows={rows} />
          </div>
        </>
      )}
    </Shell>
  );
}

/**
 * Counts come from the database, not from the page of rows.
 *
 * The table is capped at 1000 for the screen's sake, so counting the array
 * would quietly under-report the day the list outgrows one page.
 */
async function loadWaitlist() {
  const sb = serviceClient();

  // Midnight in Lagos, expressed as the UTC instant it happened. Lagos is
  // UTC+1 all year, so no daylight-saving special case is needed.
  const LAGOS_OFFSET_MS = 60 * 60 * 1000;
  const lagos = new Date(Date.now() + LAGOS_OFFSET_MS);
  const startOfDay = new Date(
    Date.UTC(lagos.getUTCFullYear(), lagos.getUTCMonth(), lagos.getUTCDate()) - LAGOS_OFFSET_MS,
  ).toISOString();

  const [list, total, today, invited, answered] = await Promise.all([
    sb
      .from("waitlist")
      .select("id, phone, email, work, cadence, source, ref, via, details_at, invited_at, created_at")
      .order("created_at", { ascending: false })
      .limit(1000),
    sb.from("waitlist").select("*", { count: "exact", head: true }),
    sb.from("waitlist").select("*", { count: "exact", head: true }).gte("created_at", startOfDay),
    sb.from("waitlist").select("*", { count: "exact", head: true }).not("invited_at", "is", null),
    sb.from("waitlist").select("*", { count: "exact", head: true }).not("details_at", "is", null),
  ]);

  return {
    rows: (list.data ?? []) as Row[],
    counts: {
      total: total.count ?? 0,
      today: today.count ?? 0,
      invited: invited.count ?? 0,
      answered: answered.count ?? 0,
    },
    error: list.error,
  };
}
