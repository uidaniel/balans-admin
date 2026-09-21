"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Logo } from "@/components/ui";

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
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-sm">
        <Logo tone="light" className="mx-auto h-9 w-auto" />

        <h1 className="mt-8 text-center font-display text-2xl font-bold tracking-tight">
          Balans admin
        </h1>
        <p className="mt-2 text-center text-[0.95rem] text-ink/60">Staff only.</p>

        {state.status === "sent" ? (
          <div
            role="status"
            className="animate-rise mt-8 rounded-[20px] bg-white px-6 py-5 text-center ring-1 ring-ink/10 ring-inset"
          >
            <p className="font-semibold">Check your email.</p>
            <p className="mt-1.5 text-[0.95rem] leading-relaxed text-ink/65">
              We sent a link that signs you in. It lasts an hour.
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} noValidate className="mt-8">
            <label htmlFor="email" className="sr-only">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@balans.ng"
              className="h-12 w-full rounded-full bg-white px-5 text-base text-ink ring-1 ring-ink/15 outline-none ring-inset placeholder:text-ink/40 focus:ring-ink/45"
            />
            <button
              type="submit"
              disabled={state.status === "sending"}
              className="mt-3 inline-flex h-12 w-full items-center justify-center rounded-full bg-ink font-semibold text-cream transition-colors hover:bg-ink-3 disabled:opacity-60"
            >
              {state.status === "sending" ? "Sending…" : "Email me a link"}
            </button>

            <div aria-live="polite" className="mt-3 min-h-5 text-center">
              {state.status === "error" && (
                <p className="text-sm font-medium text-clay">{state.message}</p>
              )}
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
