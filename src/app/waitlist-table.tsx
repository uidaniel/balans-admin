"use client";

import { useMemo, useState } from "react";

export type Row = {
  id: string;
  email: string;
  work: string | null;
  source: string | null;
  ref: string | null;
  invited_at: string | null;
  created_at: string;
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
      [r.email, r.work, r.source, r.ref].some((v) => v?.toLowerCase().includes(needle)),
    );
  }, [rows, q]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search email, work, source…"
          aria-label="Search the waitlist"
          className="h-11 w-full max-w-sm rounded-full bg-white px-5 text-base text-ink ring-1 ring-ink/15 outline-none ring-inset placeholder:text-ink/40 focus:ring-ink/45"
        />
        {q && (
          <p className="text-sm text-ink/55">
            {shown.length} of {rows.length}
          </p>
        )}
      </div>

      {shown.length === 0 ? (
        <p className="mt-6 rounded-[20px] bg-white px-5 py-8 text-center text-ink/55 ring-1 ring-ink/8 ring-inset">
          {rows.length === 0 ? "Nobody has signed up yet." : "Nothing matches that."}
        </p>
      ) : (
        <div className="mt-4 overflow-hidden rounded-[20px] bg-white ring-1 ring-ink/8 ring-inset">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] text-left text-[0.95rem]">
              <thead>
                <tr className="border-b border-ink/10 text-[0.78rem] tracking-[0.06em] text-ink/45 uppercase">
                  <th className="px-5 py-3 font-semibold">Email</th>
                  <th className="px-5 py-3 font-semibold">Bills for</th>
                  <th className="px-5 py-3 font-semibold">Source</th>
                  <th className="px-5 py-3 font-semibold">Ref</th>
                  <th className="px-5 py-3 font-semibold">Joined</th>
                  <th className="px-5 py-3 font-semibold">Invited</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id} className="border-b border-ink/6 last:border-0">
                    <td className="px-5 py-3 font-medium">
                      <a href={`mailto:${r.email}`} className="hover:underline">
                        {r.email}
                      </a>
                    </td>
                    <td className="px-5 py-3 text-ink/65">{r.work || "–"}</td>
                    <td className="px-5 py-3 text-ink/65">{r.source || "–"}</td>
                    <td className="px-5 py-3 text-ink/65">{r.ref || "–"}</td>
                    <td className="px-5 py-3 whitespace-nowrap text-ink/65">{when(r.created_at)}</td>
                    <td className="px-5 py-3">
                      {r.invited_at ? (
                        <span className="rounded-full bg-moss/15 px-2 py-0.5 text-[0.75rem] font-semibold text-moss">
                          Sent
                        </span>
                      ) : (
                        <span className="text-ink/35">–</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
