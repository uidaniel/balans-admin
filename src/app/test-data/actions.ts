"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { serviceClient } from "@/lib/supabase";
import { currentStaff } from "@/lib/supabase-server";

/*
 * Marking test data (5 November 2026). Admins only, every change in
 * audit_log with what it was before, and every one can be taken back: a
 * mark leaves rows where they are and only keeps them out of the totals.
 */

const UUID = /^[0-9a-f-]{36}$/i;

function back(form: FormData, q: Record<string, string>): never {
  const raw = String(form.get("back") ?? "/test-data");
  const base = raw.startsWith("/test-data") || raw.startsWith("/users/") ? raw : "/test-data";
  const url = new URL(base, "http://x");
  for (const k of ["test_ok", "test_error"]) url.searchParams.delete(k);
  for (const [k, v] of Object.entries(q)) url.searchParams.set(k, v);
  redirect(`${url.pathname}?${url.searchParams.toString()}${url.hash}`);
}

function refresh(): void {
  for (const p of ["/test-data", "/", "/analytics", "/users"]) revalidatePath(p);
}

/** An account as a test, or back among the real ones. */
export async function setTestAccount(form: FormData): Promise<void> {
  const staff = await currentStaff();
  if (!staff) redirect("/login");
  if (staff.role !== "admin") back(form, { test_error: "Only an admin can mark test data." });

  const userId = String(form.get("user") ?? "");
  const on = String(form.get("on") ?? "") === "1";
  if (!UUID.test(userId)) back(form, { test_error: "That account could not be found." });

  const db = serviceClient();
  const { data: before, error } = await db.from("users").select("is_test, business_name, wa_phone").eq("id", userId).maybeSingle();
  if (error || !before) back(form, { test_error: error?.message ?? "No such account." });

  const { error: upErr } = await db.from("users").update({ is_test: on }).eq("id", userId);
  if (upErr) back(form, { test_error: upErr.message });

  await db.from("audit_log").insert({
    actor_type: "staff",
    actor_id: staff.email,
    action: on ? "user.mark_test" : "user.unmark_test",
    target_type: "user",
    target_id: userId,
    before_json: { is_test: before.is_test },
    after_json: { is_test: on },
  });
  refresh();
  const who = before.business_name ?? `+${before.wa_phone}`;
  back(form, { test_ok: on ? `${who} is now a test account and is left out of every total.` : `${who} counts again.` });
}

/** One invoice out of the totals, or back in. */
export async function setLeftOut(form: FormData): Promise<void> {
  const staff = await currentStaff();
  if (!staff) redirect("/login");
  if (staff.role !== "admin") back(form, { test_error: "Only an admin can mark test data." });

  const docId = String(form.get("document") ?? "");
  const on = String(form.get("on") ?? "") === "1";
  if (!UUID.test(docId)) back(form, { test_error: "That invoice could not be found." });

  const db = serviceClient();
  const { data: before, error } = await db.from("documents").select("left_out, number, type").eq("id", docId).maybeSingle();
  if (error || !before) back(form, { test_error: error?.message ?? "No such invoice." });

  const { error: upErr } = await db.from("documents").update({ left_out: on }).eq("id", docId);
  if (upErr) back(form, { test_error: upErr.message });

  await db.from("audit_log").insert({
    actor_type: "staff",
    actor_id: staff.email,
    action: on ? "document.leave_out" : "document.put_back",
    target_type: "document",
    target_id: docId,
    before_json: { left_out: before.left_out },
    after_json: { left_out: on },
  });
  refresh();
  const what = `${before.type === "quote" ? "Quote" : "Invoice"}${before.number ? ` #${before.number}` : ""}`;
  back(form, { test_ok: on ? `${what} is left out of the totals.` : `${what} counts again.` });
}
