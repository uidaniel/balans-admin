"use client";

import { useMemo, useState } from "react";
import { Avatar, Card, Empty, Pill, table } from "@/components/ui";
import { Icon } from "@/components/icons";

export type Row = {
  id: string;
  /** Normalised +234XXXXXXXXXX. The list is phone-first; email is optional. */
  phone: string | null;
  email: string | null;
  work: string | null;
  cadence: string | null;
  source: string | null;
  ref: string | null;
  /** The referral code of whoever shared the link this signup arrived through. */
  via: string | null;
  /** Set when step two of the form was answered. */
  details_at: string | null;
  invited_at: string | null;
  created_at: string;
};

const CADENCE: Record<string, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  sometimes: "Now and then",
};

/** +2348012345678 back to 0801 234 5678, which is how a Nigerian reads it. */
const phoneText = (e164: string) => {
  const n = e164.replace(/^\+234/, "");
  return n.length === 10 ? `0${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}` : e164;
};

const when = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Lagos",
  }).format(new Date(iso));

export function WaitlistTable({ rows }: { rows: Row[] }) {
  const [q, setQ] = useState("");

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) =>
      // The raw number as well as the readable one, so both 0801… and +234…
      // find the same row however the person searching happens to type it.
      [r.phone, r.phone && phoneText(r.phone), r.email, r.work, r.cadence, r.source, r.ref, r.via].some(
        (v) => v?.toLowerCase().includes(needle),
      ),
    );
  }, [rows, q]);

  return (
    <Card flush>
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
        <label className="relative w-full max-w-sm">
          <span className="sr-only">Search the waitlist</span>
          <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink/40" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search number, email, work, source…"
            className="h-10 w-full rounded-xl border border-line bg-white pr-3 pl-9 text-sm outline-none placeholder:text-ink/40 focus:border-ink/40 focus:ring-4 focus:ring-ink/5"
          />
        </label>
        <p className="text-sm text-ink/50 tabular-nums">
          {q ? `${shown.length} of ${rows.length}` : `${rows.length.toLocaleString("en-NG")} shown`}
        </p>
      </div>

      {shown.length === 0 ? (
        <div className="border-t border-line">
          <Empty icon="users">{rows.length === 0 ? "Nobody has signed up yet." : "Nothing matches that."}</Empty>
        </div>
      ) : (
        <div className={table.wrap}>
          <table className={`${table.table} min-w-248`}>
            <thead className={table.head}>
              <tr>
                <th className={table.th}>WhatsApp</th>
                <th className={table.th}>Email</th>
                <th className={table.th}>Bills for</th>
                <th className={table.th}>How often</th>
                <th className={table.th}>Source</th>
                <th className={table.th}>Ref</th>
                <th className={table.th}>Joined</th>
                <th className={table.th}>Invited</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id} className={table.row}>
                  <td className={`${table.td} whitespace-nowrap`}>
                    {r.phone ? (
                      <a
                        href={`https://wa.me/${r.phone.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2.5 font-medium hover:underline"
                      >
                        <Avatar name={r.work || r.email || r.phone} className="size-8" />
                        <span className="tabular-nums">{phoneText(r.phone)}</span>
                      </a>
                    ) : (
                      // Rows from before the form went phone-first. They can
                      // only be reached by email.
                      <span className="text-ink/35">–</span>
                    )}
                  </td>
                  <td className={`${table.td} text-ink/65`}>
                    {r.email ? (
                      <a href={`mailto:${r.email}`} className="hover:underline">
                        {r.email}
                      </a>
                    ) : (
                      "–"
                    )}
                  </td>
                  <td className={`${table.td} text-ink/65`}>{r.work || "–"}</td>
                  <td className={`${table.td} whitespace-nowrap`}>
                    {r.cadence ? <Pill tone="neutral" dot={false}>{CADENCE[r.cadence] ?? r.cadence}</Pill> : <span className="text-ink/35">–</span>}
                  </td>
                  <td className={`${table.td} text-ink/65`}>{r.source || "–"}</td>
                  <td className={`${table.td} text-ink/65`}>
                    {r.ref ? <span className="font-mono text-xs">{r.ref}</span> : "–"}
                    {r.via && <span className="ml-1 text-xs text-ink/40">via {r.via}</span>}
                  </td>
                  <td className={`${table.td} whitespace-nowrap text-ink/60 tabular-nums`}>{when(r.created_at)}</td>
                  <td className={table.td}>
                    {r.invited_at ? <Pill tone="moss">Sent</Pill> : <Pill tone="neutral">Waiting</Pill>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
