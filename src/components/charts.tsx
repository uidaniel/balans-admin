/*
 * The dashboard's charts, drawn as SVG on the server.
 *
 * No chart library. Thirty points and a handful of slices need none, and a
 * library would bring a client bundle, hydration, and a dependency that can
 * break a page whose whole job is to be looked at in a hurry. These render as
 * markup, work with JavaScript off, and print.
 *
 * Text is never inside a stretched SVG — an SVG drawn with
 * preserveAspectRatio="none" squashes its letters — so labels sit in HTML
 * around the drawing, and the drawing only draws.
 */

export const PALETTE = ["#10231c", "#f5b82e", "#3f8f5f", "#c2462e", "#8aa399", "#d99a12", "#ddd3bf"] as const;

/* -------------------------------------------------------------------------- */
/* Sparkline                                                                  */
/* -------------------------------------------------------------------------- */

export function Sparkline({
  values,
  stroke = "currentColor",
  fill = "currentColor",
  className = "h-10 w-full",
}: {
  values: number[];
  stroke?: string;
  fill?: string;
  className?: string;
}) {
  if (values.length < 2) return <div className={className} />;
  const max = Math.max(1, ...values);
  const step = 100 / (values.length - 1);
  const pts = values.map((v, i) => `${(i * step).toFixed(2)},${(30 - (v / max) * 26 - 2).toFixed(2)}`);
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className={className} aria-hidden>
      <polygon points={`0,30 ${pts.join(" ")} 100,30`} fill={fill} opacity="0.14" />
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke={stroke}
        strokeWidth="1.6"
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/* Area chart                                                                 */
/* -------------------------------------------------------------------------- */

/** A nice round top for an axis: 1,234 -> 1,500; 87 -> 100. */
function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (v <= m * p) return m * p;
  return 10 * p;
}

export function AreaChart({
  points,
  format,
  id,
  height = 220,
}: {
  points: { label: string; value: number }[];
  format: (v: number) => string;
  /** Unique per page, for the gradient's id. */
  id: string;
  height?: number;
}) {
  const max = niceMax(Math.max(0, ...points.map((p) => p.value)));
  const W = 600;
  const H = 200;
  const step = points.length > 1 ? W / (points.length - 1) : W;
  const xy = points.map((p, i) => [i * step, H - (p.value / max) * (H - 8) - 4] as const);
  const line = xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const ticks = [1, 0.75, 0.5, 0.25, 0];
  const last = xy[xy.length - 1];

  return (
    <div className="relative" style={{ height }}>
      <div className="absolute inset-y-0 left-0 right-16">
        {ticks.map((t) => (
          <div key={t} className="absolute inset-x-0 border-t border-dashed border-ink/10" style={{ top: `${(1 - t) * 100}%` }} />
        ))}
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
          <defs>
            <linearGradient id={`g-${id}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#f5b82e" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#f5b82e" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <polygon points={`0,${H} ${line} ${W},${H}`} fill={`url(#g-${id})`} />
          <polyline
            points={line}
            fill="none"
            stroke="#10231c"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
          />
        </svg>
        {last && (
          <span
            className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink ring-4 ring-marigold/40"
            style={{ left: "100%", top: `${(last[1] / H) * 100}%` }}
          />
        )}
        {/* Invisible columns, one per day, so hovering anywhere says what it was. */}
        <div className="absolute inset-0 flex">
          {points.map((p) => (
            <div key={p.label} title={`${p.label}: ${format(p.value)}`} className="flex-1 hover:bg-ink/[0.03]" />
          ))}
        </div>
      </div>
      <div className="absolute inset-y-0 right-0 w-14">
        {ticks.map((t) => (
          <span
            key={t}
            className="absolute right-0 -translate-y-1/2 text-[0.68rem] tabular-nums text-ink/40"
            style={{ top: `${(1 - t) * 100}%` }}
          >
            {format(max * t)}
          </span>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Bars                                                                       */
/* -------------------------------------------------------------------------- */

/** Two series side by side per day, sharing one scale each. */
export function DualBars({
  labels,
  a,
  b,
  height = 180,
}: {
  labels: string[];
  a: { name: string; values: number[] };
  b: { name: string; values: number[] };
  height?: number;
}) {
  const maxA = Math.max(1, ...a.values);
  const maxB = Math.max(1, ...b.values);
  return (
    <div>
      <div className="flex items-end gap-[3px]" style={{ height }}>
        {labels.map((l, i) => (
          <div key={l} className="flex h-full flex-1 items-end gap-px" title={`${l}: ${a.values[i]} ${a.name.toLowerCase()}, ${b.values[i]} ${b.name.toLowerCase()}`}>
            <div
              className={`flex-1 rounded-t-[3px] ${a.values[i] ? "bg-ink" : "bg-ink/8"}`}
              style={{ height: `${Math.max(3, (100 * (a.values[i] ?? 0)) / maxA)}%` }}
            />
            <div
              className={`flex-1 rounded-t-[3px] ${b.values[i] ? "bg-marigold" : "bg-marigold/15"}`}
              style={{ height: `${Math.max(3, (100 * (b.values[i] ?? 0)) / maxB)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-ink/55">
        <Key color="#10231c" label={a.name} />
        <Key color="#f5b82e" label={b.name} />
      </div>
    </div>
  );
}

export function Key({ color, label, value }: { color: string; label: string; value?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="size-2.5 rounded-[3px]" style={{ background: color }} />
      {label}
      {value && <span className="font-semibold text-ink tabular-nums">{value}</span>}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Donut                                                                      */
/* -------------------------------------------------------------------------- */

export function Donut({
  slices,
  center,
  sub,
  size = 148,
}: {
  slices: { label: string; value: number; color?: string }[];
  center: string;
  sub?: string;
  size?: number;
}) {
  const total = slices.reduce((t, s) => t + s.value, 0);
  const R = 42;
  const C = 2 * Math.PI * R;
  let offset = 0;

  return (
    <div className="flex flex-wrap items-center gap-5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden>
          <circle cx="50" cy="50" r={R} fill="none" stroke="#e9e1d0" strokeWidth="11" />
          {total > 0 &&
            slices.map((s, i) => {
              const len = (s.value / total) * C;
              const el = (
                <circle
                  key={s.label}
                  cx="50"
                  cy="50"
                  r={R}
                  fill="none"
                  stroke={s.color ?? PALETTE[i % PALETTE.length]}
                  strokeWidth="11"
                  strokeDasharray={`${Math.max(0, len - 0.6)} ${C}`}
                  strokeDashoffset={-offset}
                >
                  <title>{`${s.label}: ${s.value}`}</title>
                </circle>
              );
              offset += len;
              return el;
            })}
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="font-display text-xl font-extrabold tabular-nums leading-none">{center}</p>
            {sub && <p className="mt-1 text-[0.65rem] tracking-wide text-ink/45 uppercase">{sub}</p>}
          </div>
        </div>
      </div>
      <ul className="min-w-[140px] flex-1 space-y-1.5 text-sm">
        {slices.length === 0 && <li className="text-ink/45">Nothing yet</li>}
        {slices.map((s, i) => (
          <li key={s.label} className="flex items-center justify-between gap-3">
            <Key color={s.color ?? PALETTE[i % PALETTE.length]!} label={s.label} />
            <span className="tabular-nums text-ink/60">
              {s.value}
              {total > 0 && <span className="ml-1.5 text-ink/35">{Math.round((100 * s.value) / total)}%</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Gauge                                                                      */
/* -------------------------------------------------------------------------- */

/** A half-circle meter, 0–100. Green at or above the target, clay below. */
export function Gauge({ pct, target, label }: { pct: number | null; target: number; label: string }) {
  const v = pct === null ? 0 : Math.max(0, Math.min(100, pct));
  const R = 40;
  const half = Math.PI * R;
  const color = pct === null ? "#ddd3bf" : v >= target ? "#3f8f5f" : "#c2462e";
  return (
    <div className="text-center">
      <svg viewBox="0 0 100 56" className="mx-auto w-full max-w-[200px]" aria-hidden>
        <path d="M10 50 A40 40 0 0 1 90 50" fill="none" stroke="#e9e1d0" strokeWidth="10" strokeLinecap="round" />
        <path
          d="M10 50 A40 40 0 0 1 90 50"
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${(v / 100) * half} ${half}`}
        />
        {/* The target, as a tick on the arc. */}
        <line
          x1={50 - 40 * Math.cos((Math.PI * target) / 100)}
          y1={50 - 40 * Math.sin((Math.PI * target) / 100)}
          x2={50 - 29 * Math.cos((Math.PI * target) / 100)}
          y2={50 - 29 * Math.sin((Math.PI * target) / 100)}
          stroke="#10231c"
          strokeWidth="1.5"
        />
      </svg>
      <p className="-mt-3 font-display text-3xl font-extrabold tabular-nums">{pct === null ? "—" : `${Math.round(v)}%`}</p>
      <p className="mt-1 text-xs text-ink/50">
        {label} · target {target}%
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Funnel                                                                     */
/* -------------------------------------------------------------------------- */

export function Funnel({ steps }: { steps: { label: string; value: number }[] }) {
  const top = Math.max(1, steps[0]?.value ?? 1);
  return (
    <ol className="space-y-2.5">
      {steps.map((s, i) => {
        const prev = i > 0 ? steps[i - 1]!.value : null;
        const kept = prev ? Math.round((100 * s.value) / Math.max(1, prev)) : null;
        return (
          <li key={s.label}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="font-semibold">{s.label}</span>
              <span className="tabular-nums">
                <span className="font-display text-base font-bold">{s.value}</span>
                {kept !== null && (
                  <span className={`ml-2 text-xs ${kept >= 50 ? "text-moss" : "text-clay"}`}>{kept}% of the step before</span>
                )}
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-sand">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.max(2, (100 * s.value) / top)}%`,
                  background: `linear-gradient(90deg, #10231c, ${i % 2 ? "#3f8f5f" : "#1f3d32"})`,
                }}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* -------------------------------------------------------------------------- */
/* Ranked bars                                                                */
/* -------------------------------------------------------------------------- */

export function RankedBars({
  items,
  empty = "Nothing yet",
  color = "#10231c",
}: {
  items: { label: string; value: number; note?: string }[];
  empty?: string;
  color?: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (items.length === 0) return <p className="text-sm text-ink/45">{empty}</p>;
  return (
    <ul className="space-y-2.5">
      {items.map((it) => (
        <li key={it.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate">{it.label}</span>
            <span className="shrink-0 tabular-nums font-semibold">
              {it.value}
              {it.note && <span className="ml-1.5 font-normal text-ink/45">{it.note}</span>}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-ink/6">
            <div className="h-full rounded-full" style={{ width: `${(100 * it.value) / max}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/* -------------------------------------------------------------------------- */
/* Hour of day                                                                */
/* -------------------------------------------------------------------------- */

export function HourStrip({ counts }: { counts: number[] }) {
  const max = Math.max(1, ...counts);
  const peak = counts.indexOf(Math.max(...counts));
  return (
    <div>
      <div className="grid grid-cols-24 gap-1" style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}>
        {counts.map((c, h) => (
          <div
            key={h}
            title={`${String(h).padStart(2, "0")}:00 — ${c}`}
            className="aspect-[1/2.2] rounded-[4px]"
            style={{ background: c ? `rgba(245,184,46,${0.18 + (0.82 * c) / max})` : "rgba(16,35,28,0.05)" }}
          />
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[0.68rem] text-ink/40">
        <span>00:00</span>
        <span>06:00</span>
        <span>12:00</span>
        <span>18:00</span>
        <span>23:00</span>
      </div>
      {counts.some((c) => c > 0) && (
        <p className="mt-2 text-xs text-ink/55">
          Busiest at <strong className="font-semibold text-ink">{String(peak).padStart(2, "0")}:00</strong> Lagos time
        </p>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Change against the week before                                             */
/* -------------------------------------------------------------------------- */

/** Last 7 days against the 7 before them, from a 30-day series. */
export function weekChange(values: number[]): number | null {
  const last = values.slice(-7).reduce((a, b) => a + b, 0);
  const prev = values.slice(-14, -7).reduce((a, b) => a + b, 0);
  if (prev === 0) return last === 0 ? 0 : null;
  return ((last - prev) / prev) * 100;
}

export function Delta({ pct, dark = false }: { pct: number | null; dark?: boolean }) {
  if (pct === null) return <span className={`text-xs ${dark ? "text-cream/50" : "text-ink/45"}`}>new this week</span>;
  const up = pct >= 0;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${
        up ? (dark ? "bg-moss/30 text-[#9fd6b2]" : "bg-moss/12 text-moss") : dark ? "bg-clay/30 text-[#f0a794]" : "bg-clay/10 text-clay"
      }`}
    >
      {up ? "▲" : "▼"} {Math.abs(pct).toFixed(0)}%
      <span className={`font-normal ${dark ? "text-cream/50" : "text-ink/45"}`}>vs last week</span>
    </span>
  );
}
