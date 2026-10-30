"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Logo } from "@/components/ui";
import { Icon } from "@/components/icons";

/**
 * Staff sign-in.
 *
 * A magic link rather than a password: there are two or three of us, nobody
 * needs another password to lose, and it means no password hashes to hold.
 * Signing in still grants nothing on its own — `admin_allowlist` decides
 * access, and it is checked on the server on every page.
 *
 * PRD-GAP: F28 requires two-factor authentication for the back office. A link
 * to a verified mailbox is single-factor; TOTP goes in before the admin can
 * see user or payment records.
 */
type State = { status: "idle" | "sending" | "sent" } | { status: "error"; message: string };

export default function AdminLogin() {
  const [state, setState] = useState<State>({ status: "idle" });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state.status === "sending") return;

    const email = String(new FormData(e.currentTarget).get("email") ?? "").trim();
    if (!email) return setState({ status: "error", message: "Enter your email address." });

    setState({ status: "sending" });

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      return setState({ status: "error", message: "Supabase is not configured on this deployment." });
    }

    const supabase = createBrowserClient(url, key);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        // Only people already on the allowlist can get anywhere, but refusing
        // to create accounts keeps unknown addresses out of auth entirely.
        shouldCreateUser: true,
      },
    });

    if (error) {
      setState({ status: "error", message: error.message });
      return;
    }
    setState({ status: "sent" });
  }

  return (
    <main className="flex min-h-dvh flex-col lg:grid lg:grid-cols-[1.1fr_1fr]">
      {/* Brand panel: a band across the top of a phone, the left half from lg up. */}
      <section className="on-night relative isolate overflow-hidden bg-night px-5 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-16 text-cream sm:px-8 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div aria-hidden className="pointer-events-none absolute -top-32 -right-24 -z-10 size-[28rem] rounded-full bg-marigold/20 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-40 -left-20 -z-10 size-[26rem] rounded-full bg-moss/25 blur-3xl" />
        <div aria-hidden className="noise pointer-events-none absolute inset-0 -z-10" />
        <Logo tone="dark" className="h-8 w-auto self-start lg:h-9" />
        <div className="mt-10 max-w-md lg:mt-0">
          <p className="font-display text-[2rem] leading-[1.08] font-light tracking-[-0.035em] lg:text-[3rem]">
            The whole business, <span className="text-marigold">on one page.</span>
          </p>
          <p className="mt-4 hidden leading-relaxed text-cream/60 sm:block">
            Money collected, who is signing up, what the bot is sending, and what needs a look. Live from the database.
          </p>
        </div>
        <p className="hidden text-xs text-cream/40 lg:block">Staff only · access is checked on every page</p>
      </section>

      <section className="relative -mt-8 flex flex-1 justify-center rounded-t-[28px] bg-canvas px-4 pt-8 pb-12 sm:px-8 lg:mt-0 lg:items-center lg:rounded-none lg:py-12">
        <div className="w-full max-w-sm">
          <h1 className="font-display text-[1.75rem] leading-tight font-light tracking-[-0.03em] sm:text-[2rem]">Sign in to admin</h1>
          <p className="mt-1.5 text-[0.95rem] text-ink/55">We will email you a link. No password needed.</p>

          {state.status === "sent" ? (
            <div role="status" className="animate-rise mt-8 flex gap-3 rounded-[22px] border border-line bg-white p-5 shadow-card">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-moss/10 text-moss">
                <Icon name="mail" className="size-[1.1rem]" />
              </span>
              <div>
                <p className="font-medium">Check your email.</p>
                <p className="mt-1 text-sm leading-relaxed text-ink/60">We sent a link that signs you in. It lasts an hour.</p>
              </div>
            </div>
          ) : (
            <form onSubmit={onSubmit} noValidate className="mt-8">
              <label htmlFor="email" className="text-sm font-medium text-ink/70">
                Work email
              </label>
              <div className="relative mt-1.5">
                <Icon name="mail" className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-ink/40" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@balans.ng"
                  className="h-12 w-full rounded-full border border-line bg-white pr-4 pl-11 text-base text-ink outline-none placeholder:text-ink/40 focus:border-ink/40 focus:ring-4 focus:ring-ink/[0.06] focus-visible:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={state.status === "sending"}
                className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-ink font-medium text-cream transition-colors hover:bg-ink-3 disabled:opacity-60"
              >
                {state.status === "sending" ? "Sending…" : "Email me a link"}
                {state.status !== "sending" && <Icon name="arrowRight" className="size-4 text-marigold" />}
              </button>

              <div aria-live="polite" className="mt-3 min-h-5">
                {state.status === "error" && <p className="text-sm font-medium text-clay">{state.message}</p>}
              </div>
            </form>
          )}
          <p className="mt-10 text-xs text-ink/40 lg:hidden">Staff only · access is checked on every page</p>
        </div>
      </section>
    </main>
  );
}
