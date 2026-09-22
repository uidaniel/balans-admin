"use client";

import { useMemo, useState } from "react";

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
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search number, email, work, source…"
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
            <table className="w-full min-w-[62rem] text-left text-[0.95rem]">
              <thead>
                <tr className="border-b border-ink/10 text-[0.78rem] tracking-[0.06em] text-ink/45 uppercase">
                  <th className="px-5 py-3 font-semibold">WhatsApp</th>
                  <th className="px-5 py-3 font-semibold">Email</th>
                  <th className="px-5 py-3 font-semibold">Bills for</th>
                  <th className="px-5 py-3 font-semibold">How often</th>
                  <th className="px-5 py-3 font-semibold">Source</th>
                  <th className="px-5 py-3 font-semibold">Ref</th>
                  <th className="px-5 py-3 font-semibold">Joined</th>
                  <th className="px-5 py-3 font-semibold">Invited</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id} className="border-b border-ink/6 last:border-0">
                    <td className="px-5 py-3 font-medium whitespace-nowrap">
                      {r.phone ? (
                        <a
                          href={`https://wa.me/${r.phone.replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline"
                        >
                          {phoneText(r.phone)}
                        </a>
                      ) : (
                        // Rows from before the form went phone-first. They can
                        // only be reached by email.
                        <span className="text-ink/35">–</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-ink/65">
                      {r.email ? (
                        <a href={`mailto:${r.email}`} className="hover:underline">
                          {r.email}
                        </a>
                      ) : (
                        "–"
                      )}
                    </td>
                    <td className="px-5 py-3 text-ink/65">{r.work || "–"}</td>
                    <td className="px-5 py-3 whitespace-nowrap text-ink/65">
                      {r.cadence ? (CADENCE[r.cadence] ?? r.cadence) : "–"}
                    </td>
                    <td className="px-5 py-3 text-ink/65">{r.source || "–"}</td>
                    <td className="px-5 py-3 text-ink/65">
                      {r.ref || "–"}
                      {r.via && <span className="ml-1 text-ink/40">via {r.via}</span>}
                    </td>
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
