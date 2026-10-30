import Image from "next/image";
import Link from "next/link";
import { Icon, type IconName } from "./icons";

type Tone = "light" | "dark";

/**
 * The wordmark: the coin and "balans" in Onest Bold. `light` is ink type for
 * light surfaces, `dark` is cream type for the night-green nav.
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
      width={458}
      height={160}
      className={className}
      unoptimized
      priority
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Buttons and fields                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Every button is a pill. Ink for the primary action, marigold only for the
 * one action a page is built around, an outline for everything else.
 */
const base =
  "inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full px-4.5 text-sm font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50 sm:h-10";

export const btn = {
  primary: `${base} bg-ink text-cream hover:bg-ink-3`,
  accent: `${base} bg-marigold text-ink hover:bg-[#f0ab14]`,
  secondary: `${base} border border-line bg-white text-ink/75 hover:border-sand-2 hover:bg-paper hover:text-ink`,
  danger: `${base} bg-clay text-white hover:bg-[#ab3c26]`,
  ghostDanger: `${base} text-clay hover:bg-clay/[0.07]`,
};

/** Text inputs and selects. 16px on phones so iOS does not zoom on focus. */
const fieldBase =
  "h-11 w-full rounded-2xl border border-line bg-white text-base text-ink outline-none transition-[border-color,box-shadow] placeholder:text-ink/35 focus:border-ink/40 focus:ring-4 focus:ring-ink/[0.06] focus-visible:outline-none disabled:bg-canvas disabled:text-ink/45 sm:h-10 sm:text-sm";
export const field = `${fieldBase} px-3.5`;
/** The same, with room on the left for a search glass. */
export const fieldWithIcon = `${fieldBase} pr-3.5 pl-10`;

/* -------------------------------------------------------------------------- */
/* Surfaces                                                                   */
/* -------------------------------------------------------------------------- */

/** The one card every panel is built from: white on the paper canvas, a hairline, a title row. */
export function Card({
  title,
  sub,
  action,
  flush = false,
  className = "",
  children,
}: {
  title?: string;
  sub?: string;
  action?: React.ReactNode;
  /** No body padding, for tables that run edge to edge. */
  flush?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`flex min-w-0 flex-col rounded-[22px] border border-line bg-white shadow-card ${className}`}>
      {title && (
        <header className="flex items-start justify-between gap-3 px-4 pt-4.5 sm:px-6 sm:pt-5.5">
          <div className="min-w-0">
            <h3 className="text-[0.95rem] leading-snug font-medium tracking-[-0.01em]">{title}</h3>
            {sub && <p className="mt-0.5 text-[0.8rem] leading-snug text-ink/50">{sub}</p>}
          </div>
          {action}
        </header>
      )}
      <div
        className={`min-w-0 flex-1 ${flush ? (title ? "pt-4" : "") : `px-4 pb-4.5 sm:px-6 sm:pb-6 ${title ? "pt-4" : "pt-4.5 sm:pt-5.5"}`}`}
      >
        {children}
      </div>
    </section>
  );
}

/** The grid a row of figures sits in: two across on a phone, four on a wide screen. */
export const statGrid = "grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4";

/**
 * A headline figure. `dark` sets it on the night green, with the soft
 * marigold glow, for the one figure a page leads with.
 */
export function Kpi({
  label,
  value,
  icon,
  delta,
  deltaNote = "vs previous 7 days",
  note,
  dark = false,
  className = "",
  children,
}: {
  label: string;
  value: string;
  icon: IconName;
  delta?: number | null;
  deltaNote?: string;
  note?: string;
  dark?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`relative isolate flex min-w-0 flex-col overflow-hidden rounded-[22px] p-4 sm:p-5 ${
        dark ? "bg-night text-cream shadow-lift" : "border border-line bg-white shadow-card"
      } ${className}`}
    >
      {dark && (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute -top-20 -right-16 -z-10 size-56 rounded-full bg-marigold/25 blur-3xl"
          />
          <div aria-hidden className="pointer-events-none absolute -bottom-24 -left-10 -z-10 size-48 rounded-full bg-moss/25 blur-3xl" />
          <div aria-hidden className="noise pointer-events-none absolute inset-0 -z-10" />
        </>
      )}
      <div className="flex items-start justify-between gap-3">
        <p className={`text-[0.82rem] leading-snug font-medium ${dark ? "text-cream/70" : "text-ink/55"}`}>{label}</p>
        <Icon name={icon} className={`mt-px size-4 shrink-0 ${dark ? "text-marigold" : "text-ink/30"}`} />
      </div>
      <p className="mt-2.5 font-display text-[1.6rem] leading-none font-light tracking-[-0.03em] tabular-nums sm:text-[2.1rem]">
        {value}
      </p>
      {note && <p className={`mt-2 text-[0.8rem] leading-snug ${dark ? "text-cream/55" : "text-ink/50"}`}>{note}</p>}
      {delta !== undefined && (
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1">
          <Delta pct={delta} dark={dark} />
          <span className={`text-xs ${dark ? "text-cream/45" : "text-ink/40"}`}>{deltaNote}</span>
        </div>
      )}
      {children && <div className="mt-auto pt-4">{children}</div>}
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
  className = "",
}: {
  label: string;
  value: string;
  note?: string;
  icon?: IconName;
  tone?: "clay" | "moss";
  className?: string;
}) {
  return (
    <div className={`flex min-w-0 flex-col rounded-[20px] border border-line bg-white p-4 shadow-card sm:p-5 ${className}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[0.8rem] leading-snug font-medium text-ink/55">{label}</p>
        {icon && (
          <Icon
            name={icon}
            className={`mt-px size-4 shrink-0 ${tone === "clay" ? "text-clay" : tone === "moss" ? "text-moss" : "text-ink/30"}`}
          />
        )}
      </div>
      <p
        className={`mt-2 font-display text-[1.15rem] leading-tight font-normal tracking-[-0.025em] break-words tabular-nums min-[400px]:text-[1.25rem] sm:text-[1.6rem] ${
          tone === "clay" ? "text-clay" : ""
        }`}
      >
        {value}
      </p>
      {note && <p className="mt-1.5 text-xs leading-relaxed text-ink/50">{note}</p>}
    </div>
  );
}

/** Title and one line of context, above a group of cards. */
export function SectionTitle({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="mt-12 mb-4 flex flex-wrap items-end justify-between gap-3 sm:mt-14 sm:mb-5">
      <div className="min-w-0">
        <h2 className="font-display text-[1.4rem] leading-tight font-light tracking-[-0.02em] sm:text-[1.6rem]">{title}</h2>
        {sub && <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink/50">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

/** A notice above the content: an error, a confirmation, a heads-up. */
export function Notice({
  tone,
  title,
  children,
  action,
  className = "",
  role,
}: {
  tone: "clay" | "moss" | "marigold";
  title?: React.ReactNode;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  role?: "status" | "alert";
}) {
  const t = {
    clay: { box: "border-clay/20 bg-[#fbefea]", icon: "text-clay", head: "text-clay" },
    moss: { box: "border-moss/20 bg-[#edf5ef]", icon: "text-moss", head: "text-moss" },
    marigold: { box: "border-marigold/40 bg-[#fdf3dc]", icon: "text-marigold-ink", head: "text-ink" },
  }[tone];
  return (
    <div
      role={role}
      className={`flex flex-wrap items-start gap-x-3 gap-y-3 rounded-[20px] border px-4 py-3.5 text-sm sm:px-5 ${t.box} ${className}`}
    >
      <Icon name={tone === "moss" ? "check" : "alert"} className={`mt-0.5 size-4 shrink-0 ${t.icon}`} />
      <div className="min-w-0 flex-1 basis-56 leading-relaxed">
        {title && <p className={`font-medium ${t.head}`}>{title}</p>}
        {children && (
          <div className={title ? "mt-0.5 text-ink/70" : tone === "marigold" ? "text-ink/80" : t.head}>{children}</div>
        )}
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
        className={`rounded-full px-2 py-0.5 text-xs font-medium ${dark ? "bg-cream/10 text-cream/75" : "bg-canvas text-ink/55"}`}
      >
        New
      </span>
    );
  }
  const up = pct >= 0;
  const tone = up
    ? dark
      ? "bg-moss/30 text-[#b5e6c6]"
      : "bg-moss/10 text-moss"
    : dark
      ? "bg-clay/30 text-[#f7bcae]"
      : "bg-clay/10 text-clay";
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${tone}`}>
      <Icon name={up ? "arrowUp" : "arrowDown"} className="size-3" />
      {Math.abs(pct).toFixed(pct !== 0 && Math.abs(pct) < 10 ? 1 : 0)}%
    </span>
  );
}

export type PillTone = "moss" | "clay" | "marigold" | "ink" | "neutral";

const PILL: Record<PillTone, string> = {
  moss: "bg-moss/10 text-moss ring-moss/20",
  clay: "bg-clay/10 text-clay ring-clay/20",
  marigold: "bg-marigold/15 text-marigold-ink ring-marigold/35",
  ink: "bg-ink text-cream ring-ink",
  neutral: "bg-canvas text-ink/60 ring-line",
};

/** A status, with a dot unless it is the dark "ink" kind. */
export function Pill({ tone = "neutral", dot = true, children }: { tone?: PillTone; dot?: boolean; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset ${PILL[tone]}`}
    >
      {dot && tone !== "ink" && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

const AVATAR = [
  "bg-marigold/20 text-marigold-ink",
  "bg-moss/15 text-moss",
  "bg-ink text-cream",
  "bg-clay/12 text-clay",
  "bg-sand text-ink-3",
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
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-full text-[0.72rem] font-medium ${AVATAR[h % AVATAR.length]} ${className}`}
    >
      {initials}
    </span>
  );
}

/** Links styled as a segmented control; the address holds the state. Scrolls inside itself on a phone. */
export function Segmented({ items, current }: { items: { id: string; label: string; href: string }[]; current: string }) {
  return (
    <nav className="no-scrollbar -mx-4 max-w-[calc(100%+2rem)] overflow-x-auto px-4 sm:mx-0 sm:max-w-full sm:px-0">
      <div className="inline-flex gap-1 rounded-full bg-canvas p-1">
        {items.map((it) => (
          <Link
            key={it.id}
            href={it.href}
            aria-current={it.id === current ? "page" : undefined}
            className={`inline-flex h-10 shrink-0 items-center rounded-full px-3.5 text-[0.82rem] font-medium whitespace-nowrap transition-colors sm:h-9 ${
              it.id === current ? "bg-white text-ink shadow-[0_1px_2px_rgba(16,35,28,0.1)]" : "text-ink/55 hover:text-ink"
            }`}
          >
            {it.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

export function MoreLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="-my-1 inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-line px-3.5 text-[0.8rem] font-medium text-ink/70 transition-colors hover:bg-paper hover:text-ink sm:h-9"
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
      <p className="max-w-sm text-sm leading-relaxed text-ink/55">{children}</p>
    </div>
  );
}

/**
 * Shared table styling, so every list reads the same.
 *
 * Tables are for wide screens. Below the breakpoint each list renders as
 * compact row cards instead (`list` / `item`), so a phone never scrolls a
 * nine-column table sideways. `wrap` still scrolls inside the card in the
 * middle widths, where a table is shown but may not quite fit.
 */
export const table = {
  wrap: "scroll-x",
  table: "w-full text-left text-sm",
  head: "border-y border-line bg-paper text-xs font-medium text-ink/50",
  th: "px-4 py-3 font-medium whitespace-nowrap first:pl-6 last:pr-6",
  row: "border-b border-line/70 transition-colors last:border-0 hover:bg-paper",
  td: "px-4 py-3.5 align-middle first:pl-6 last:pr-6",
  /** The phone list: one row card per record. */
  list: "divide-y divide-line/80 border-t border-line",
  item: "px-4 py-3.5 sm:px-6",
};
