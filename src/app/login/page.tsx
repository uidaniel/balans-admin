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
    <main className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      {/* Brand panel, from lg up. */}
      <section className="relative hidden overflow-hidden bg-ink p-12 text-cream lg:flex lg:flex-col lg:justify-between">
        <div aria-hidden className="pointer-events-none absolute -top-32 -right-24 size-[28rem] rounded-full bg-marigold/20 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-40 -left-20 size-[26rem] rounded-full bg-moss/30 blur-3xl" />
        <Logo tone="dark" className="relative h-9 w-auto self-start" />
        <div className="relative max-w-md">
          <p className="font-display text-[2.4rem] leading-[1.1] font-semibold tracking-tight">
            The whole business, <span className="text-marigold">on one page.</span>
          </p>
          <p className="mt-4 text-cream/60">
            Money collected, who is signing up, what the bot is sending, and what needs a look. Live from the database.
          </p>
        </div>
        <p className="relative text-xs text-cream/40">Staff only · access is checked on every page</p>
      </section>

      <section className="grid place-items-center px-4 py-12">
        <div className="w-full max-w-sm">
          <Logo tone="light" className="h-8 w-auto lg:hidden" />

          <h1 className="mt-8 font-display text-[1.75rem] font-semibold tracking-tight lg:mt-0">Sign in to admin</h1>
          <p className="mt-1.5 text-[0.95rem] text-ink/55">We will email you a link. No password needed.</p>

          {state.status === "sent" ? (
            <div role="status" className="animate-rise mt-8 flex gap-3 rounded-2xl border border-line bg-white p-5">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-moss/10 text-moss">
                <Icon name="mail" className="size-[1.1rem]" />
              </span>
              <div>
                <p className="font-semibold">Check your email.</p>
                <p className="mt-1 text-sm leading-relaxed text-ink/60">We sent a link that signs you in. It lasts an hour.</p>
              </div>
            </div>
          ) : (
            <form onSubmit={onSubmit} noValidate className="mt-8">
              <label htmlFor="email" className="text-sm font-medium text-ink/70">
                Work email
              </label>
              <div className="relative mt-1.5">
                <Icon name="mail" className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink/40" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@balans.ng"
                  className="h-12 w-full rounded-xl border border-line bg-white pr-4 pl-10 text-base text-ink outline-none placeholder:text-ink/40 focus:border-ink/40 focus:ring-4 focus:ring-ink/5"
                />
              </div>
              <button
                type="submit"
                disabled={state.status === "sending"}
                className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-ink font-medium text-cream transition-colors hover:bg-ink-3 disabled:opacity-60"
              >
                {state.status === "sending" ? "Sending…" : "Email me a link"}
                {state.status !== "sending" && <Icon name="arrowRight" className="size-4 text-marigold" />}
              </button>

              <div aria-live="polite" className="mt-3 min-h-5">
                {state.status === "error" && <p className="text-sm font-medium text-clay">{state.message}</p>}
              </div>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
