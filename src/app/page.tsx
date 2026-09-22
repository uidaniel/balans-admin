import { redirect } from "next/navigation";
import { serviceClient, supabaseConfigured } from "@/lib/supabase";
import { access } from "@/lib/supabase-server";
import { storageMode } from "@/lib/waitlist";
import { WaitlistTable, type Row } from "./waitlist-table";
import { MetricsPanel, type Metrics } from "./metrics";
import { signOut } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  if (!supabaseConfigured) return <NotConfigured />;

  const who = await access();
  if (who.kind === "anonymous") redirect("/login");
  if (who.kind === "not_staff") return <NotStaff authUserId={who.authUserId} email={who.email} />;
  const staff = who.staff;

  const [{ rows, counts, error }, metrics] = await Promise.all([loadWaitlist(), loadMetrics()]);

  if (error) {
    return (
      <Shell email={staff.email}>
        <p className="rounded-2xl bg-white px-5 py-4 text-clay ring-1 ring-clay/20 ring-inset">
          Could not read the waitlist: {error.message}
        </p>
      </Shell>
    );
  }

  return (
    <Shell email={staff.email}>
      {storageMode() === "file" && (
        <p className="mb-6 rounded-2xl bg-marigold/25 px-5 py-4 text-[0.95rem] leading-relaxed">
          <strong className="font-semibold">Signups are going to a local file.</strong>{" "}
          SUPABASE_SERVICE_ROLE_KEY is not set on this deployment, so the form is writing to
          <code className="mx-1 rounded bg-ink/10 px-1.5 py-0.5 text-[0.85em]">.waitlist.jsonl</code>
          instead of the table below. On a serverless host that write fails and the address is lost.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="On the list" value={counts.total} />
        <Stat label="Joined today" value={counts.today} />
        <Stat label="Told us more" value={counts.answered} />
        <Stat label="Invited" value={counts.invited} />
      </div>

      <MetricsPanel m={metrics} />

      <h2 className="mt-10 font-display text-lg font-bold tracking-tight">Waitlist</h2>
      <div className="mt-4">
        <WaitlistTable rows={rows} />
      </div>
    </Shell>
  );
}

/**
 * Counts come from the database, not from the page of rows.
 *
 * The table is capped at 1000 for the screen's sake, so counting the array
 * would quietly under-report the day the list outgrows one page. Reading the
 * clock also belongs out here: it is not a pure thing to do while rendering.
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
    // Step two of the form is optional, so this is the number of people who
    // told us what they bill for and how often. That is the pool the first
    // twenty get picked from, and it is a different figure from the total.
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

/**
 * The dashboard's numbers, from the `admin_metrics` view.
 *
 * Returns null rather than throwing: the waitlist is the older half of this
 * page and must still render if the view is missing on this database, which
 * it will be until the API's migrations have run against it.
 */
async function loadMetrics(): Promise<Metrics | null> {
  try {
    const { data, error } = await serviceClient().from("admin_metrics").select("*").single();
    if (error) return null;
    return data as Metrics;
  } catch {
    return null;
  }
}

function Shell({ email, children }: { email: string; children: React.ReactNode }) {
  return (
    <div className="container-x py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Waitlist</h1>
          <p className="mt-1 text-sm text-ink/55">Signed in as {email}</p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/export"
            className="inline-flex h-10 items-center rounded-full bg-white px-4 text-sm font-semibold ring-1 ring-ink/15 transition-colors ring-inset hover:ring-ink/40"
          >
            Export CSV
          </a>
          <form action={signOut}>
            <button
              type="submit"
              className="inline-flex h-10 items-center rounded-full px-4 text-sm font-semibold text-ink/60 transition-colors hover:text-ink"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>
      <div className="mt-8">{children}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[20px] bg-white px-5 py-4 ring-1 ring-ink/8 ring-inset">
      <p className="label text-ink/40">{label}</p>
      <p className="mt-1 font-display text-3xl font-extrabold tabular-nums">{value}</p>
    </div>
  );
}

/**
 * The first sign-in always lands here: Supabase Auth has the person, the
 * allowlist does not yet. Rather than a dead end, hand over the exact row to
 * insert — there is no other way to bootstrap the first admin.
 */
function NotStaff({ authUserId, email }: { authUserId: string; email: string }) {
  const sql = `insert into admin_allowlist (auth_user_id, email, role)
values ('${authUserId}', '${email}', 'admin');`;
  return (
    <main className="container-x grid min-h-dvh max-w-2xl place-items-center py-10">
      <div className="w-full rounded-[20px] bg-white px-6 py-6 ring-1 ring-ink/10 ring-inset">
        <h1 className="font-display text-xl font-bold tracking-tight">You are signed in, but not staff</h1>
        <p className="mt-3 leading-relaxed text-ink/70">
          Signing in is not the same as being allowed in. To add <strong>{email}</strong>, run this in the
          Supabase SQL editor, then reload:
        </p>
        <pre className="mt-4 overflow-x-auto rounded-xl bg-ink px-4 py-3 font-mono text-[0.8rem] leading-relaxed text-cream">
          {sql}
        </pre>
        <form action={signOut} className="mt-5">
          <button type="submit" className="text-sm font-semibold text-ink/60 hover:text-ink">
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}

function NotConfigured() {
  return (
    <main className="container-x grid min-h-dvh max-w-xl place-items-center py-10">
      <div className="rounded-[20px] bg-white px-6 py-6 ring-1 ring-ink/10 ring-inset">
        <h1 className="font-display text-xl font-bold tracking-tight">Admin is not configured</h1>
        <p className="mt-3 leading-relaxed text-ink/70">
          Set <code className="rounded bg-ink/8 px-1.5 py-0.5 text-[0.9em]">NEXT_PUBLIC_SUPABASE_URL</code>,{" "}
          <code className="rounded bg-ink/8 px-1.5 py-0.5 text-[0.9em]">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> and{" "}
          <code className="rounded bg-ink/8 px-1.5 py-0.5 text-[0.9em]">SUPABASE_SERVICE_ROLE_KEY</code>, then
          redeploy.
        </p>
      </div>
    </main>
  );
}
