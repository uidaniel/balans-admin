/*
 * Small pieces shared by the Overview and Analytics pages: the figures in a
 * row, and how numbers, hours and dates are written.
 */

export function Mini({ label, value, tone }: { label: string; value: number; tone?: "moss" | "clay" }) {
  return (
    <div className="px-2 py-3 text-center">
      <p
        className={`font-display text-[1.3rem] leading-tight font-light tracking-[-0.025em] tabular-nums ${
          tone === "moss" ? "text-moss" : tone === "clay" ? "text-clay" : ""
        }`}
      >
        {value.toLocaleString("en-NG")}
      </p>
      <p className="mt-0.5 text-xs text-ink/50">{label}</p>
    </div>
  );
}

export function Row({ k, v, strong, muted }: { k: string; v: string; strong?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={muted ? "text-ink/45" : "text-ink/65"}>{k}</dt>
      <dd className={`shrink-0 text-right tabular-nums ${strong ? "font-medium text-ink" : muted ? "text-ink/45" : ""}`}>{v}</dd>
    </div>
  );
}

/** "25 Sep", for chart labels where the year is noise. */
export const dayMonth = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Africa/Lagos" }).format(new Date(iso));

/** ₦1.2m, ₦350k, ₦900 — for axes, where the full figure would not fit. */
export function compactNaira(kobo: number): string {
  const v = kobo / 100;
  if (v >= 1_000_000) return `₦${(v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1)}m`;
  if (v >= 1_000) return `₦${Math.round(v / 1_000)}k`;
  return `₦${Math.round(v)}`;
}

export function formatHours(h: number): string {
  if (h < 1) return `${Math.round(h * 60)} min`;
  if (h < 48) return `${h.toFixed(h < 10 ? 1 : 0)} h`;
  return `${(h / 24).toFixed(1)} days`;
}

/** " · 40%", or nothing when there is nothing to take a share of. */
export function share(part: number, whole: number, of = ""): string {
  return whole > 0 ? ` · ${Math.round((100 * part) / whole)}%${of}` : "";
}

export function formatMinutes(m: number): string {
  if (m < 60) return `${m} min`;
  if (m < 60 * 48) return `${(m / 60).toFixed(1)} hours`;
  return `${(m / 1440).toFixed(1)} days`;
}

export const titleCase = (s: string) => s.replace(/[_-]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());
