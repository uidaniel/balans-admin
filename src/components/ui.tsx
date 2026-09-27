import Image from "next/image";
import Link from "next/link";
import { Icon, type IconName } from "./icons";

type Tone = "light" | "dark";

/**
 * The wordmark.
 *
 * Copied from the marketing site rather than shared: this is a separate
 * application now, and a login screen that cannot render because a package was
 * not published is a login screen nobody can use. The file is small and it
 * changes about once a year.
 */
export function Logo({ tone = "light", className = "h-7 w-auto" }: { tone?: Tone; className?: string }) {
  return (
    <Image
      src={`/brand/balans-logo-${tone}.svg`}
      alt="Balans"
      width={467}
      height={160}
      className={className}
      unoptimized
      priority
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Surfaces                                                                   */
/* -------------------------------------------------------------------------- */

/** The one card every panel is built from: white on the canvas, a hairline, a title row. */
export function Card({
  title,
  sub,
  icon,
  action,
  flush = false,
  className = "",
  children,
}: {
  title?: string;
  sub?: string;
  icon?: IconName;
  action?: React.ReactNode;
  /** No body padding, for tables that run edge to edge. */
  flush?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`flex min-w-0 flex-col rounded-2xl border border-line bg-white ${className}`}>
      {title && (
        <header className="flex items-start justify-between gap-3 px-5 pt-5 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            {icon && (
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-canvas text-ink/70">
                <Icon name={icon} className="size-[1.05rem]" />
              </span>
            )}
            <div className="min-w-0">
              <h3 className="truncate text-[0.95rem] font-semibold tracking-tight">{title}</h3>
              {sub && <p className="truncate text-xs text-ink/50">{sub}</p>}
            </div>
          </div>
          {action}
        </header>
      )}
      <div className={`flex-1 ${flush ? (title ? "pt-4" : "") : `px-5 pb-5 sm:px-6 sm:pb-6 ${title ? "pt-4" : "pt-5"}`}`}>
        {children}
      </div>
    </section>
  );
}

/**
 * A headline figure. `dark` inverts it for the one figure a page leads with.
 */
export function Kpi({
  label,
  value,
  icon,
  delta,
  deltaNote = "vs previous 7 days",
  note,
  dark = false,
  children,
}: {
  label: string;
  value: string;
  icon: IconName;
  delta?: number | null;
  deltaNote?: string;
  note?: string;
  dark?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`relative flex min-w-0 flex-col overflow-hidden rounded-2xl p-5 ${
        dark ? "bg-ink text-cream" : "border border-line bg-white"
      }`}
    >
      {dark && (
        <div aria-hidden className="pointer-events-none absolute -top-16 -right-16 size-48 rounded-full bg-marigold/25 blur-3xl" />
      )}
      <div className="relative flex items-start justify-between gap-3">
        <p className={`text-sm font-medium ${dark ? "text-cream/70" : "text-ink/55"}`}>{label}</p>
        <span
          className={`grid size-9 shrink-0 place-items-center rounded-full ${
            dark ? "bg-marigold text-ink" : "border border-line text-ink/70"
          }`}
        >
          <Icon name={icon} className="size-4" />
        </span>
      </div>
      <p className="relative mt-2 font-display text-[1.9rem] leading-tight font-semibold tracking-tight tabular-nums">
        {value}
      </p>
      {note && <p className={`relative mt-1 text-[0.8rem] ${dark ? "text-cream/55" : "text-ink/50"}`}>{note}</p>}
      {delta !== undefined && (
        <div className="relative mt-3 flex flex-wrap items-center gap-2">
          <Delta pct={delta} dark={dark} />
          <span className={`text-xs ${dark ? "text-cream/45" : "text-ink/40"}`}>{deltaNote}</span>
        </div>
      )}
      {children && <div className="relative mt-auto pt-4">{children}</div>}
    </div>
  );
}

/** A plain figure for a row of four. */
export function Stat({
  label,
  value,
  note,
  icon,
  tone,
}: {
  label: string;
  value: string;
  note?: string;
  icon?: IconName;
  tone?: "clay" | "moss";
}) {
  return (
    <div className="flex min-w-0 items-start gap-3.5 rounded-2xl border border-line bg-white p-5">
      {icon && (
        <span
          className={`grid size-10 shrink-0 place-items-center rounded-xl ${
            tone === "clay" ? "bg-clay/10 text-clay" : tone === "moss" ? "bg-moss/10 text-moss" : "bg-canvas text-ink/70"
          }`}
        >
          <Icon name={icon} className="size-[1.1rem]" />
        </span>
      )}
      <div className="min-w-0">
        <p className="text-[0.8rem] font-medium text-ink/55">{label}</p>
        <p
          className={`mt-0.5 font-display text-[1.45rem] leading-tight font-semibold tracking-tight tabular-nums ${
            tone === "clay" ? "text-clay" : ""
          }`}
        >
          {value}
        </p>
        {note && <p className="mt-1 text-xs leading-relaxed text-ink/50">{note}</p>}
      </div>
    </div>
  );
}

/** Title and one line of context, above a group of cards. */
export function SectionTitle({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="mt-10 mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="font-display text-lg font-semibold tracking-tight">{title}</h2>
        {sub && <p className="mt-0.5 text-sm text-ink/50">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Small pieces                                                               */
/* -------------------------------------------------------------------------- */

/** Last 7 days against the 7 before, as a pill. */
export function Delta({ pct, dark = false }: { pct: number | null; dark?: boolean }) {
  if (pct === null) {
    return (
      <span
        className={`rounded-md px-1.5 py-0.5 text-xs font-semibold ${dark ? "bg-cream/10 text-cream/70" : "bg-canvas text-ink/55"}`}
      >
        New
      </span>
    );
  }
  const up = pct >= 0;
  const tone = up
    ? dark
      ? "bg-moss/35 text-[#a9e0bd]"
      : "bg-moss/10 text-moss"
    : dark
      ? "bg-clay/35 text-[#f5b3a3]"
      : "bg-clay/10 text-clay";
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums ${tone}`}>
      <Icon name={up ? "arrowUp" : "arrowDown"} className="size-3" />
      {Math.abs(pct).toFixed(pct !== 0 && Math.abs(pct) < 10 ? 1 : 0)}%
    </span>
  );
}

export type PillTone = "moss" | "clay" | "marigold" | "ink" | "neutral";

const PILL: Record<PillTone, string> = {
  moss: "bg-moss/10 text-moss ring-moss/20",
  clay: "bg-clay/10 text-clay ring-clay/20",
  marigold: "bg-marigold/15 text-[#9a6a04] ring-marigold/35",
  ink: "bg-ink text-cream ring-ink",
  neutral: "bg-canvas text-ink/60 ring-line",
};

/** A status, with a dot unless it is the dark "ink" kind. */
export function Pill({ tone = "neutral", dot = true, children }: { tone?: PillTone; dot?: boolean; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset ${PILL[tone]}`}
    >
      {dot && tone !== "ink" && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

const AVATAR = [
  "bg-marigold/20 text-[#8a5d00]",
  "bg-moss/15 text-moss",
  "bg-ink text-cream",
  "bg-clay/12 text-clay",
  "bg-[#8aa399]/25 text-ink-3",
];

/** Initials in a circle, the colour fixed by the name so a person keeps theirs. */
export function Avatar({ name, className = "size-9" }: { name: string; className?: string }) {
  const clean = name.replace(/[^\p{L}\p{N}\s]/gu, " ").trim();
  const words = clean.split(/\s+/).filter(Boolean);
  const initials = (words.length > 1 ? words[0]![0]! + words[1]![0]! : (words[0] ?? "?").slice(0, 2)).toUpperCase();
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full text-[0.72rem] font-semibold ${AVATAR[h % AVATAR.length]} ${className}`}
    >
      {initials}
    </span>
  );
}

/** Links styled as a segmented control; the address holds the state. */
export function Segmented({ items, current }: { items: { id: string; label: string; href: string }[]; current: string }) {
  return (
    <nav className="inline-flex max-w-full gap-1 overflow-x-auto rounded-xl bg-canvas p-1">
      {items.map((it) => (
        <Link
          key={it.id}
          href={it.href}
          aria-current={it.id === current ? "page" : undefined}
          className={`inline-flex h-8 shrink-0 items-center rounded-lg px-3 text-[0.82rem] font-medium whitespace-nowrap transition-colors ${
            it.id === current ? "bg-white text-ink shadow-[0_1px_2px_rgba(16,35,28,0.08)] ring-1 ring-line" : "text-ink/55 hover:text-ink"
          }`}
        >
          {it.label}
        </Link>
      ))}
    </nav>
  );
}

export function MoreLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-line px-3 text-[0.8rem] font-medium text-ink/70 transition-colors hover:bg-canvas hover:text-ink"
    >
      {children}
      <Icon name="arrowRight" className="size-3.5" />
    </Link>
  );
}

export function Empty({ icon = "file", children }: { icon?: IconName; children: React.ReactNode }) {
  return (
    <div className="grid place-items-center gap-3 px-6 py-12 text-center">
      <span className="grid size-11 place-items-center rounded-full bg-canvas text-ink/45">
        <Icon name={icon} className="size-5" />
      </span>
      <p className="text-sm text-ink/55">{children}</p>
    </div>
  );
}

/** Shared table styling, so every list reads the same. */
export const table = {
  wrap: "overflow-x-auto",
  table: "w-full text-left text-sm",
  head: "border-y border-line bg-canvas/60 text-[0.72rem] font-medium tracking-wide text-ink/45 uppercase",
  th: "px-4 py-2.5 font-medium first:pl-5 last:pr-5 sm:first:pl-6 sm:last:pr-6",
  row: "border-b border-line/70 transition-colors last:border-0 hover:bg-canvas/50",
  td: "px-4 py-3 first:pl-5 last:pr-5 sm:first:pl-6 sm:last:pr-6",
};
