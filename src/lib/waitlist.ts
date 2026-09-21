/**
 * Waitlist storage and validation (pre-launch stand-in for F24).
 *
 * Balans has not opened yet, so every "start" surface collects intent instead
 * of creating an account. Nothing here touches money, Monnify or a user row.
 *
 * Entries go to Supabase, which is the same Postgres the platform service uses.
 * They are not a mailing list held somewhere else: at launch the admin mails
 * this table, and `converted_user_id` closes the loop on who actually arrived.
 *
 * Without Supabase configured the entry is appended to a JSONL file so the form
 * genuinely works in local development instead of pretending. That file cannot
 * work on a serverless host, whose filesystem is read-only, which is why
 * `storageMode()` exists and why the admin shows which one is live.
 */

import { appendFile, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { serviceClient, supabaseConfigured } from "./supabase";

export type WaitlistEntry = {
  email: string;
  work?: string;
  source?: string;
  ref?: string;
  ipHash?: string;
  userAgent?: string;
};

export type WaitlistError = { ok: false; field: "email" | "work" | "form"; message: string };
export type WaitlistResult = { ok: true; already: boolean } | WaitlistError;

const STORE = join(process.cwd(), ".waitlist.jsonl");

/**
 * Deliberately permissive. The job is to catch typos and obvious rubbish, not
 * to adjudicate RFC 5322: a real address wrongly rejected costs us more than a
 * junk one accepted.
 */
const EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export function validate(
  input: Record<string, unknown>,
): { ok: true; email: string; work?: string } | WaitlistError {
  const email = text(input.email, 320).toLowerCase();

  if (!email) {
    return { ok: false, field: "email", message: "Enter your email address." };
  }
  if (email.length > 254 || !EMAIL.test(email)) {
    return { ok: false, field: "email", message: "That does not look like an email address." };
  }

  const work = text(input.work, 121);
  if (work.length > 120) {
    return { ok: false, field: "work", message: "Keep this under 120 characters." };
  }

  return { ok: true, email, work: work || undefined };
}

/** Which store is live. The admin surfaces this so nobody guesses. */
export function storageMode(): "supabase" | "file" {
  return supabaseConfigured && process.env.SUPABASE_SERVICE_ROLE_KEY ? "supabase" : "file";
}

/** An IP is personal data; a salted digest is enough to spot abuse. */
export function hashIp(ip: string): string {
  const salt = process.env.IP_HASH_SALT ?? "balans";
  return createHash("sha256").update(salt).update(ip).digest("hex").slice(0, 32);
}

export async function addToWaitlist(entry: WaitlistEntry): Promise<WaitlistResult> {
  return storageMode() === "supabase" ? toSupabase(entry) : toFile(entry);
}

async function toSupabase(entry: WaitlistEntry): Promise<WaitlistResult> {
  try {
    const { error } = await serviceClient().from("waitlist").insert({
      email: entry.email,
      work: entry.work ?? null,
      source: entry.source ?? null,
      ref: entry.ref ?? null,
      ip_hash: entry.ipHash ?? null,
      user_agent: entry.userAgent ?? null,
    });

    // 23505 is unique_violation: this address is already on the list, which is
    // not a failure. Telling them so is friendlier than a silent success and
    // avoids a second round trip to find out.
    if (error?.code === "23505") return { ok: true, already: true };
    if (error) throw new Error(`${error.code}: ${error.message}`);

    return { ok: true, already: false };
  } catch (error) {
    console.error("[waitlist] supabase insert failed", error);
    return failed();
  }
}

async function toFile(entry: WaitlistEntry): Promise<WaitlistResult> {
  try {
    const raw = await readFile(STORE, "utf8").catch(() => "");
    const already = raw
      .split("\n")
      .filter(Boolean)
      .some((line) => {
        try {
          return (JSON.parse(line) as { email?: string }).email === entry.email;
        } catch {
          return false;
        }
      });
    if (already) return { ok: true, already: true };

    await appendFile(STORE, JSON.stringify({ ...entry, createdAt: new Date().toISOString() }) + "\n", "utf8");
    return { ok: true, already: false };
  } catch (error) {
    console.error("[waitlist] local store failed", error);
    return failed();
  }
}

/** Errors say what to do next and never blame the person (design system 13). */
const failed = (): WaitlistError => ({
  ok: false,
  field: "form",
  message: "That did not go through. Try again in a minute.",
});

/* -------------------------------------------------------------------------- */
/* Rate limiting                                                              */
/* -------------------------------------------------------------------------- */

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;
const hits = new Map<string, number[]>();

/**
 * In-process, so it is per-instance. Enough to blunt a careless script; the
 * real velocity controls live in F26 once the backend exists.
 */
export function rateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);

  if (hits.size > 5_000) hits.clear(); // Crude ceiling on memory.

  return recent.length > MAX_PER_WINDOW;
}
