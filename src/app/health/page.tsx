import { serviceClient } from "@/lib/supabase";
import { Card, Empty, Notice, Pill, Stat, table, type PillTone } from "@/components/ui";
import { Failed, gate, Shell } from "../shell";
import { Refresh } from "./refresh";

export const dynamic = "force-dynamic";

/*
 * How everything Balans depends on is doing.
 *
 * The API checks each one every two minutes and keeps the latest answer in
 * `service_health` (api: src/jobs/health.ts, migration 0038). This page only
 * reads that table, so it needs no way of its own to reach the API — and when
 * every row has stopped updating, that is the API being down, which is said
 * at the top in so many words.
 */

type Row = {
  name: string;
  status: "ok" | "warn" | "down";
  latency_ms: number | null;
  detail: string | null;
  checked_at: string;
  last_ok_at: string | null;
};

/** Twice the check interval and a bit: past this the API has stopped reporting. */
const STALE_MS = 6 * 60_000;

const TONE: Record<Row["status"], { label: string; tone: PillTone }> = {
  ok: { label: "Working", tone: "moss" },
  warn: { label: "Attention", tone: "marigold" },
  down: { label: "Down", tone: "clay" },
};

const ago = (iso: string | null, now: number): string => {
  if (!iso) return "never";
  const m = Math.round((now - new Date(iso).getTime()) / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h} h ago` : `${Math.round(h / 24)} days ago`;
};

/**
 * The time this request is rendered at. The page is force-dynamic and server
 * rendered, so reading the clock once per request is the point; kept outside
 * the component so the render itself stays pure.
 */
const requestTime = () => Date.now();

export default async function HealthPage() {
  const g = await gate();
  if (!g.staff) return g.stop;

  const { data, error } = await serviceClient().from("service_health").select("*").order("name");
  const rows = (data ?? []) as Row[];
  const now = requestTime();
  const newest = rows.reduce((t, r) => Math.max(t, new Date(r.checked_at).getTime()), 0);
  const stale = rows.length > 0 && now - newest > STALE_MS;
  const down = rows.filter((r) => r.status === "down").length;
  const warn = rows.filter((r) => r.status === "warn").length;

  return (
    <Shell
      email={g.staff.email}
      current="/health"
      title="Health"
      sub="Every service Balans depends on, checked by the API every two minutes."
      actions={<Refresh />}
    >
      {error ? (
        <Failed what="health checks" error={error.message} />
      ) : rows.length === 0 ? (
        <Card>
          <Empty icon="activity">No checks yet. They start about a minute after the API boots.</Empty>
        </Card>
      ) : (
        <>
          {stale && (
            <Notice
              tone="clay"
              role="alert"
              className="mb-4"
              title={`The API has not reported for ${ago(new Date(newest).toISOString(), now)}.`}
            >
              It may be down or restarting. The rows below are its last answers, not current ones.
            </Notice>
          )}

          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
            <Stat
              className="col-span-2 sm:col-span-1"
              icon="activity"
              label="API"
              value={stale ? "Not reporting" : "Reporting"}
              note={`Last check ${ago(new Date(newest).toISOString(), now)}`}
              tone={stale ? "clay" : "moss"}
            />
            <Stat icon="alert" label="Down" value={String(down)} note={down ? "Needs fixing" : "Nothing down"} tone={down ? "clay" : undefined} />
            <Stat icon="zap" label="Needs attention" value={String(warn)} note={`${rows.length} checks in all`} />
          </div>

          <Card flush>
            {/* Phone: one row per service, status on the right. */}
            <ul className="divide-y divide-line/80 md:hidden">
              {rows.map((r) => {
                const st = TONE[r.status];
                return (
                  <li key={r.name} className={table.item}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate font-medium">{r.name}</p>
                      <Pill tone={stale ? "neutral" : st.tone}>{st.label}</Pill>
                    </div>
                    {r.detail && <p className="mt-1 text-[0.82rem] leading-snug break-words text-ink/65">{r.detail}</p>}
                    <p className="mt-1.5 flex flex-wrap gap-x-3 text-xs text-ink/45 tabular-nums">
                      <span>{r.latency_ms === null ? "—" : `${r.latency_ms.toLocaleString("en-GB")} ms`}</span>
                      <span>Checked {ago(r.checked_at, now)}</span>
                      {r.status !== "ok" && <span>Last working {ago(r.last_ok_at, now)}</span>}
                    </p>
                  </li>
                );
              })}
            </ul>
            <div className={`${table.wrap} hidden md:block`}>
              <table className={`${table.table} min-w-180`}>
                <thead className={table.head}>
                  <tr>
                    <th className={table.th}>Service</th>
                    <th className={table.th}>Status</th>
                    <th className={table.th}>Detail</th>
                    <th className={`${table.th} text-right`}>Took</th>
                    <th className={table.th}>Checked</th>
                    <th className={table.th}>Last working</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {rows.map((r) => {
                    const st = TONE[r.status];
                    return (
                      <tr key={r.name} className={table.row}>
                        <td className={`${table.td} font-medium whitespace-nowrap`}>{r.name}</td>
                        <td className={table.td}>
                          <Pill tone={stale ? "neutral" : st.tone}>{st.label}</Pill>
                        </td>
                        <td className={`${table.td} text-ink/70`}>{r.detail ?? "—"}</td>
                        <td className={`${table.td} text-right text-ink/55 whitespace-nowrap`}>
                          {r.latency_ms === null ? "—" : `${r.latency_ms.toLocaleString("en-GB")} ms`}
                        </td>
                        <td className={`${table.td} whitespace-nowrap text-ink/60`}>{ago(r.checked_at, now)}</td>
                        <td className={`${table.td} whitespace-nowrap text-ink/60`}>
                          {r.status === "ok" ? "Now" : ago(r.last_ok_at, now)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </Shell>
  );
}
