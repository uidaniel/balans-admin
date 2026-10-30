"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Avatar, Logo } from "@/components/ui";
import { Icon } from "@/components/icons";
import { GROUPS, NAV, TABS, type NavHref } from "./nav";
import { signOut } from "./actions";

/*
 * The phone's frame, below lg: a night-green top bar, a tab bar along the
 * bottom for the four pages used most, and a sheet with every page and the
 * account behind "More" (or the avatar). The sheet is a native <dialog>, so
 * it traps focus, closes on Escape and leaves the page behind inert.
 */
export function MobileNav({ current, name, email }: { current: NavHref; name: string; email: string }) {
  const sheet = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const d = sheet.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
    if (!open) return;
    // The page behind should not scroll under a thumb dragging the sheet.
    const root = document.documentElement;
    const before = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = before;
    };
  }, [open]);

  const tabs = NAV.filter((n) => TABS.includes(n.href));
  const moreOn = !TABS.includes(current);

  return (
    <>
      {/* Top bar. */}
      <header className="on-night sticky top-0 z-30 overflow-hidden bg-night pt-[env(safe-area-inset-top)] text-cream lg:hidden">
        <div aria-hidden className="pointer-events-none absolute -top-16 right-6 size-40 rounded-full bg-marigold/20 blur-3xl" />
        <div aria-hidden className="noise pointer-events-none absolute inset-0" />
        <div className="relative flex h-14 items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/" className="-ml-1 flex items-center gap-2.5 rounded-full px-1 py-1.5">
            <Logo tone="dark" className="h-[1.6rem] w-auto" />
            <span className="rounded-full bg-cream/10 px-2 py-0.5 text-[0.68rem] font-medium text-cream/70">Admin</span>
          </Link>
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-label="Account and all pages"
            className="-mr-1 grid size-10 place-items-center rounded-full"
          >
            <Avatar name={name} className="size-8 ring-2 ring-cream/15" />
          </button>
        </div>
      </header>

      {/* Tab bar. */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
      >
        <ul className="mx-auto grid max-w-xl grid-cols-5">
          {tabs.map((n) => {
            const on = n.href === current;
            return (
              <li key={n.href}>
                <Link
                  href={n.href}
                  aria-current={on ? "page" : undefined}
                  className="flex h-16 flex-col items-center justify-center gap-1 rounded-2xl"
                >
                  <span
                    className={`grid h-7 w-12 place-items-center rounded-full transition-colors ${
                      on ? "bg-ink text-marigold" : "text-ink/45"
                    }`}
                  >
                    <Icon name={n.icon} className="size-[1.15rem]" />
                  </span>
                  <span className={`text-[0.68rem] font-medium ${on ? "text-ink" : "text-ink/50"}`}>{n.label}</span>
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={open}
              className="flex h-16 w-full flex-col items-center justify-center gap-1 rounded-2xl"
            >
              <span
                className={`grid h-7 w-12 place-items-center rounded-full transition-colors ${
                  moreOn ? "bg-ink text-marigold" : "text-ink/45"
                }`}
              >
                <Icon name="more" className="size-[1.15rem]" />
              </span>
              <span className={`text-[0.68rem] font-medium ${moreOn ? "text-ink" : "text-ink/50"}`}>More</span>
            </button>
          </li>
        </ul>
      </nav>

      {/* Sheet. */}
      <dialog
        ref={sheet}
        className="sheet lg:hidden"
        aria-label="Account and all pages"
        onClose={() => setOpen(false)}
        onClick={(e) => {
          // A tap on the dimmed backdrop lands on the dialog itself.
          if (e.target === e.currentTarget) setOpen(false);
        }}
      >
        <div className="max-h-[88dvh] overflow-y-auto rounded-t-[28px] bg-paper px-4 pt-2.5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:px-6">
          <div aria-hidden className="mx-auto h-1 w-10 rounded-full bg-ink/15" />

          <div className="mt-4 flex items-center gap-3 rounded-[20px] border border-line bg-white p-3">
            <Avatar name={name} className="size-10" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{name}</p>
              <p className="truncate text-xs text-ink/50">{email}</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="grid size-10 shrink-0 place-items-center rounded-full text-ink/55 hover:bg-canvas hover:text-ink"
            >
              <Icon name="close" className="size-[1.1rem]" />
            </button>
          </div>

          <nav aria-label="All pages" className="mt-5 space-y-5">
            {GROUPS.map((group) => (
              <div key={group}>
                <p className="px-3 text-xs font-medium text-ink/45">{group}</p>
                <ul className="mt-1.5 space-y-1">
                  {NAV.filter((n) => n.group === group).map((n) => {
                    const on = n.href === current;
                    return (
                      <li key={n.href}>
                        <Link
                          href={n.href}
                          onClick={() => setOpen(false)}
                          aria-current={on ? "page" : undefined}
                          className={`flex h-12 items-center gap-3 rounded-2xl px-3 text-[0.95rem] font-medium transition-colors ${
                            on ? "bg-ink text-cream" : "text-ink/75 hover:bg-white hover:text-ink"
                          }`}
                        >
                          <Icon name={n.icon} className={`size-[1.15rem] ${on ? "text-marigold" : "text-ink/45"}`} />
                          <span className="flex-1">{n.label}</span>
                          {!on && <Icon name="chevronRight" className="size-4 text-ink/25" />}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>

          <form action={signOut} className="mt-6">
            <button
              type="submit"
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-line bg-white text-sm font-medium text-clay transition-colors hover:border-clay/30 hover:bg-clay/[0.05]"
            >
              <Icon name="logout" className="size-4" />
              Sign out
            </button>
          </form>
        </div>
      </dialog>
    </>
  );
}
