"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { serviceClient } from "@/lib/supabase";
import { currentStaff } from "@/lib/supabase-server";

/*
 * Moving somebody between Free and Pro by hand.
 *
 * Pro is two columns on `users`: `plan` and `plan_expires_at`, read by the
 * API's `planOf` and `stateOf`. A null expiry means Pro with no end — which is
 * what a comped account wants, and why "No end" is offered. With an end date
 * the account behaves exactly like a paid one: a renewal notice three days
 * before, then back to Free after the grace period.
 *
 * Demoting also cancels their subscription. One still being collected from
 * their payouts would otherwise put them straight back on Pro at the next
 * deduction, because the collector activates Pro on the first kobo; a paid
 * one would go on counting in MRR for somebody no longer on Pro.
 *
 * Every change goes in `audit_log` with who made it and what it was before.
 */

const MONTHS = new Set(["1", "3", "6", "12", "0"]);

function backTo(form: FormData, params: Record<string, string>): never {
  const raw = String(form.get("back") ?? "/users");
  const base = raw.startsWith("/users") ? raw : "/users";
  const url = new URL(base, "http://x");
  for (const k of ["plan_ok", "plan_error"]) url.searchParams.delete(k);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  redirect(`${url.pathname}?${url.searchParams.toString()}`);
}

export async function setPlan(form: FormData): Promise<void> {
  const staff = await currentStaff();
  if (!staff) redirect("/login");
  if (staff.role !== "admin") backTo(form, { plan_error: "Only an admin can change a plan." });

  const userId = String(form.get("user") ?? "");
  const to = String(form.get("to") ?? "");
  const months = String(form.get("months") ?? "1");
  if (!/^[0-9a-f-]{36}$/i.test(userId) || (to !== "pro" && to !== "free") || !MONTHS.has(months)) {
    backTo(form, { plan_error: "That change did not make sense. Nothing was changed." });
  }

  const db = serviceClient();
  const { data: before, error: readErr } = await db
    .from("users")
    .select("id, plan, plan_expires_at, business_name, wa_phone")
    .eq("id", userId)
    .maybeSingle();
  if (readErr || !before) backTo(form, { plan_error: readErr?.message ?? "No such user." });

  const who = before.business_name ?? `+${before.wa_phone}`;
  let after: { plan: string; plan_expires_at: string | null };

  if (to === "pro") {
    let expires: string | null = null;
    if (months !== "0") {
      const d = new Date();
      d.setMonth(d.getMonth() + Number(months));
      expires = d.toISOString();
    }
    after = { plan: "pro", plan_expires_at: expires };
  } else {
    after = { plan: "free", plan_expires_at: null };
  }

  const { error: upErr } = await db.from("users").update(after).eq("id", userId);
  if (upErr) backTo(form, { plan_error: `Could not change ${who}: ${upErr.message}` });

  let cancelled = 0;
  if (to === "free") {
    const { data } = await db
      .from("subscriptions")
      .update({ status: "cancelled" })
      .eq("user_id", userId)
      .in("status", ["pending", "collecting", "active"])
      .select("id");
    cancelled = data?.length ?? 0;
  }

  await db.from("audit_log").insert({
    actor_type: "staff",
    actor_id: staff.email,
    action: to === "pro" ? "plan.promote" : "plan.demote",
    target_type: "user",
    target_id: userId,
    before_json: { plan: before.plan, plan_expires_at: before.plan_expires_at },
    after_json: { ...after, ...(cancelled ? { subscriptions_cancelled: cancelled } : {}) },
  });

  revalidatePath("/users");
  revalidatePath("/");
  const ok =
    to === "pro"
      ? `${who} is on Pro${months === "0" ? " with no end date" : ` for ${months} month${months === "1" ? "" : "s"}`}.`
      : `${who} is on Free.${cancelled ? " Their subscription was cancelled." : ""}`;
  backTo(form, { plan_ok: ok });
}
