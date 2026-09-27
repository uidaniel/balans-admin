/*
 * The dashboard's charts, drawn on the server.
 *
 * No chart library. Thirty points and a handful of slices need none, and a
 * library would bring a client bundle, hydration, and a dependency that can
 * break a page whose whole job is to be looked at in a hurry. These render as
 * markup, work with JavaScript off, and print. Hover labels are CSS only.
 *
 * Text is never inside a stretched SVG — an SVG drawn with
 * preserveAspectRatio="none" squashes its letters — so labels sit in HTML
 * around the drawing, and the drawing only draws.
 */

export const PALETTE = ["#10231c", "#f5b82e", "#3f8f5f", "#c2462e", "#8aa399", "#d99a12", "#ddd3bf"] as const;

const TRACK = "#eef0eb";

/** A nice round top for an axis: 1,234 -> 1,500; 87 -> 100. */
function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (v <= m * p) return m * p;
  return 10 * p;
}

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
      <polygon points={`0,30 ${pts.join(" ")} 100,30`} fill={fill} opacity="0.12" />
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke={stroke}
        strokeWidth="1.75"
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Seven small columns, for a KPI card: the last week at a glance. */
export function MiniBars({ values, dark = false }: { values: number[]; dark?: boolean }) {
  const last = values.slice(-14);
  const max = Math.max(1, ...last);
  return (
    <div className="flex h-10 items-end gap-[3px]" aria-hidden>
      {last.map((v, i) => (
        <div
          key={i}
          className={`flex-1 rounded-[3px] ${
            i === last.length - 1
              ? "bg-marigold"
              : dark
                ? "bg-cream/15"
                : v
                  ? "bg-ink/15"
                  : "bg-ink/[0.06]"
          }`}
          style={{ height: `${Math.max(8, (100 * v) / max)}%` }}
        />
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Column chart                                                               */
/* -------------------------------------------------------------------------- */

/**
 * One column per day, the best day called out. Every column says its figure
 * on hover.
 */
export function ColumnChart({
  points,
  format,
  height = 260,
}: {
  points: { label: string; value: number }[];
  format: (v: number) => string;
  height?: number;
}) {
  const top = Math.max(0, ...points.map((p) => p.value));
  const max = niceMax(top);
  const peak = top > 0 ? points.findIndex((p) => p.value === top) : -1;
  const ticks = [1, 0.75, 0.5, 0.25, 0];
  const mid = Math.floor(points.length / 2);

  return (
    <div>
      <div className="flex gap-3" style={{ height }}>
        <div className="relative w-12 shrink-0">
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute right-0 -translate-y-1/2 text-[0.68rem] text-ink/40 tabular-nums"
              style={{ top: `${(1 - t) * 100}%` }}
            >
              {format(max * t)}
            </span>
          ))}
        </div>
        <div className="relative flex-1">
          {ticks.map((t) => (
            <div
              key={t}
              className={`absolute inset-x-0 border-t ${t === 0 ? "border-line" : "border-dashed border-line/80"}`}
              style={{ top: `${(1 - t) * 100}%` }}
            />
          ))}
          <div className="absolute inset-0 flex items-end gap-[3px] sm:gap-1.5">
            {points.map((p, i) => {
              const isPeak = i === peak;
              return (
                <div key={p.label} className="group relative flex h-full flex-1 items-end">
                  <div
                    className={`relative w-full rounded-t-[5px] transition-colors ${
                      isPeak ? "bg-marigold" : p.value ? "bg-marigold/30 group-hover:bg-marigold/60" : "bg-ink/[0.05]"
                    }`}
                    style={{ height: `${Math.max(1.5, (100 * p.value) / max)}%` }}
                  >
                    <span
                      className={`pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 rounded-lg bg-ink px-2 py-1 text-[0.7rem] font-medium whitespace-nowrap text-cream shadow-lg ${
                        isPeak ? "block" : "hidden group-hover:block"
                      }`}
                    >
                      {isPeak ? format(p.value) : `${p.label} · ${format(p.value)}`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="mt-2 ml-15 flex justify-between text-[0.7rem] text-ink/40">
        <span>{points[0]?.label}</span>
        <span className="hidden sm:inline">{points[mid]?.label}</span>
        <span>Today</span>
      </div>
    </div>
  );
}

/** Two series side by side per day, sharing one scale each. */
export function DualBars({
  labels,
  a,
  b,
  height = 200,
}: {
  labels: string[];
  a: { name: string; values: number[] };
  b: { name: string; values: number[] };
  height?: number;
}) {
  const maxA = Math.max(1, ...a.values);
  const maxB = Math.max(1, ...b.values);
  const sum = (v: number[]) => v.reduce((t, x) => t + x, 0);
  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-x-6 gap-y-2">
        <Key color="#10231c" label={a.name} value={sum(a.values).toLocaleString("en-NG")} />
        <Key color="#f5b82e" label={b.name} value={sum(b.values).toLocaleString("en-NG")} />
      </div>
      <div className="relative" style={{ height }}>
        {[0.5, 0].map((t) => (
          <div key={t} className="absolute inset-x-0 border-t border-dashed border-line" style={{ top: `${(1 - t) * 100}%` }} />
        ))}
        <div className="absolute inset-0 flex items-end gap-[3px] sm:gap-1">
          {labels.map((l, i) => (
            <div
              key={l}
              className="flex h-full flex-1 items-end gap-px rounded-sm hover:bg-canvas"
              title={`${l}: ${a.values[i]} ${a.name.toLowerCase()}, ${b.values[i]} ${b.name.toLowerCase()}`}
            >
              <div
                className={`flex-1 rounded-t-[3px] ${a.values[i] ? "bg-ink" : "bg-ink/[0.06]"}`}
                style={{ height: `${Math.max(2, (100 * (a.values[i] ?? 0)) / maxA)}%` }}
              />
              <div
                className={`flex-1 rounded-t-[3px] ${b.values[i] ? "bg-marigold" : "bg-marigold/15"}`}
                style={{ height: `${Math.max(2, (100 * (b.values[i] ?? 0)) / maxB)}%` }}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 flex justify-between text-[0.7rem] text-ink/40">
        <span>{labels[0]}</span>
        <span>Today</span>
      </div>
    </div>
  );
}

export function Key({ color, label, value }: { color: string; label: string; value?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-[0.8rem] text-ink/60">
      <span className="size-2.5 rounded-full" style={{ background: color }} />
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
  size = 168,
}: {
  slices: { label: string; value: number; color?: string }[];
  center: string;
  sub?: string;
  size?: number;
}) {
  const total = slices.reduce((t, s) => t + s.value, 0);
  const R = 40;
  const C = 2 * Math.PI * R;
  const gap = slices.filter((s) => s.value > 0).length > 1 ? 1.6 : 0;
  let offset = 0;

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden>
          <circle cx="50" cy="50" r={R} fill="none" stroke={TRACK} strokeWidth="12" />
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
                  strokeWidth="12"
                  strokeDasharray={`${Math.max(0, len - gap)} ${C}`}
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
            <p className="font-display text-2xl leading-none font-semibold tracking-tight tabular-nums">{center}</p>
            {sub && <p className="mt-1.5 text-xs text-ink/45">{sub}</p>}
          </div>
        </div>
      </div>
      <ul className="w-full space-y-2 text-sm">
        {slices.length === 0 && <li className="text-center text-ink/45">Nothing yet</li>}
        {slices.map((s, i) => (
          <li key={s.label} className="flex items-center justify-between gap-3">
            <span className="inline-flex min-w-0 items-center gap-2 text-ink/70">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: s.color ?? PALETTE[i % PALETTE.length] }} />
              <span className="truncate">{s.label}</span>
            </span>
            <span className="flex shrink-0 items-center gap-3 tabular-nums">
              <span className="text-ink/55">{s.value.toLocaleString("en-NG")}</span>
              <span className="w-10 text-right font-semibold">{total > 0 ? `${Math.round((100 * s.value) / total)}%` : "—"}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Ring                                                                       */
/* -------------------------------------------------------------------------- */

/** A 0–100 ring with its target marked. Moss at or above the target, clay below. */
export function Gauge({ pct, target, label }: { pct: number | null; target: number; label: string }) {
  const v = pct === null ? 0 : Math.max(0, Math.min(100, pct));
  const R = 40;
  const C = 2 * Math.PI * R;
  const color = pct === null ? "#ddd3bf" : v >= target ? "#3f8f5f" : "#c2462e";
  const a = (2 * Math.PI * target) / 100 - Math.PI / 2;
  return (
    <div className="text-center">
      <div className="relative mx-auto size-44">
        <svg viewBox="0 0 100 100" className="size-full" aria-hidden>
          <circle cx="50" cy="50" r={R} fill="none" stroke={TRACK} strokeWidth="9" />
          <circle
            cx="50"
            cy="50"
            r={R}
            fill="none"
            stroke={color}
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={`${(v / 100) * C} ${C}`}
            transform="rotate(-90 50 50)"
          />
          {/* The target, as a tick across the ring. */}
          <line
            x1={50 + 34 * Math.cos(a)}
            y1={50 + 34 * Math.sin(a)}
            x2={50 + 46 * Math.cos(a)}
            y2={50 + 46 * Math.sin(a)}
            stroke="#10231c"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <div>
            <p className="font-display text-[2rem] leading-none font-semibold tracking-tight tabular-nums">
              {pct === null ? "—" : `${Math.round(v)}%`}
            </p>
            <p className="mt-1.5 text-xs text-ink/45">{label}</p>
          </div>
        </div>
      </div>
      <p className="mt-3 text-xs text-ink/50">
        Target <span className="font-semibold text-ink">{target}%</span>
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
    <ol className="space-y-3.5">
      {steps.map((s, i) => {
        const prev = i > 0 ? steps[i - 1]!.value : null;
        const kept = prev ? Math.round((100 * s.value) / Math.max(1, prev)) : null;
        return (
          <li key={s.label}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
              <span className="flex items-center gap-2 text-ink/75">
                <span className="grid size-5 place-items-center rounded-md bg-canvas text-[0.65rem] font-semibold text-ink/55">
                  {i + 1}
                </span>
                {s.label}
              </span>
              <span className="flex items-baseline gap-2 tabular-nums">
                {kept !== null && (
                  <span className={`text-xs font-medium ${kept >= 50 ? "text-moss" : "text-clay"}`}>{kept}%</span>
                )}
                <span className="font-semibold">{s.value.toLocaleString("en-NG")}</span>
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full" style={{ background: TRACK }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.max(1.5, (100 * s.value) / top)}%`,
                  background: i === steps.length - 1 ? "#f5b82e" : "#10231c",
                  opacity: i === steps.length - 1 ? 1 : 1 - i * 0.12,
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
  if (items.length === 0) return <p className="py-6 text-center text-sm text-ink/45">{empty}</p>;
  return (
    <ul className="space-y-3">
      {items.map((it) => (
        <li key={it.label}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate text-ink/75">{it.label}</span>
            <span className="shrink-0 font-semibold tabular-nums">
              {it.value.toLocaleString("en-NG")}
              {it.note && <span className="ml-1.5 font-normal text-ink/45">{it.note}</span>}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full" style={{ background: TRACK }}>
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
      <div className="flex h-24 items-end gap-[3px]">
        {counts.map((c, h) => (
          <div
            key={h}
            title={`${String(h).padStart(2, "0")}:00 — ${c}`}
            className={`flex-1 rounded-t-[3px] ${h === peak && c ? "bg-marigold" : c ? "bg-marigold/35" : "bg-ink/[0.05]"}`}
            style={{ height: `${Math.max(6, (100 * c) / max)}%` }}
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
        <p className="mt-3 text-xs text-ink/55">
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
