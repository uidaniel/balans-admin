"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { serviceClient } from "@/lib/supabase";
import { currentStaff } from "@/lib/supabase-server";
import { CAMPAIGN, normalisePhone } from "@/lib/broadcast";

/*
 * The admin never sends anything itself. It writes a broadcast and its
 * recipients; the API's broadcast loop picks them up within about fifteen
 * seconds (migration 0029). Each action ends in a redirect with the outcome
 * in the address, so the page needs no client code to report it.
 */

const back = (params: Record<string, string>) => redirect(`/broadcast?${new URLSearchParams(params).toString()}`);

export async function sendTest(form: FormData): Promise<void> {
  const staff = await currentStaff();
  if (!staff) redirect("/login");

  const phoneTyped = String(form.get("phone") ?? "").trim();
  const emailTyped = String(form.get("email") ?? "").trim().toLowerCase();

  const phone = phoneTyped ? normalisePhone(phoneTyped) : null;
  if (phoneTyped && !phone) back({ error: `“${phoneTyped}” is not a phone number we can send to.` });
  const email = emailTyped || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) back({ error: `“${emailTyped}” is not an email address.` });
  if (!phone && !email) back({ error: "Give a phone number, an email address, or both." });

  const db = serviceClient();
  const { data, error } = await db
    .from("broadcasts")
    .insert({ campaign: CAMPAIGN, kind: "test", created_by: staff.email })
    .select("id")
    .single();
  if (error || !data) back({ error: `Could not queue the test: ${error?.message ?? "no row"}` });

  const { error: rErr } = await db.from("broadcast_recipients").insert({
    broadcast_id: data!.id,
    phone,
    email,
    wa_status: phone ? "pending" : "skipped",
    email_status: email ? "pending" : "skipped",
  });
  if (rErr) {
    await db.from("broadcasts").update({ status: "failed", note: rErr.message }).eq("id", data!.id);
    back({ error: `Could not queue the test: ${rErr.message}` });
  }

  revalidatePath("/broadcast");
  back({ queued: "test" });
}

export async function sendToEveryone(form: FormData): Promise<void> {
  const staff = await currentStaff();
  if (!staff) redirect("/login");
  if (staff.role !== "admin") back({ error: "Only an admin can send to the whole waitlist." });

  // Typed, not clicked: this cannot be taken back.
  if (String(form.get("confirm") ?? "").trim().toUpperCase() !== "SEND") {
    back({ error: "Type SEND in the box to confirm. Nothing was sent." });
  }

  const db = serviceClient();
  const { data: status } = await db.from("config").select("value_json").eq("key", "template_status").maybeSingle();
  const approved = (status?.value_json as Record<string, string> | undefined)?.[CAMPAIGN] === "APPROVED";
  if (!approved) back({ error: "Meta has not approved the template yet. Nothing was sent." });

  // How many, oldest first; blank is everyone still waiting (migration 0041).
  const raw = String(form.get("count") ?? "").trim();
  const limit = raw === "" ? null : Number(raw);
  if (limit !== null && (!Number.isInteger(limit) || limit < 1)) back({ error: "Give a whole number of people, or leave it blank for everyone." });

  // One locked call: a second press, or two admins at once, finds the first,
  // and nobody already sent to is sent to again.
  const { error } = await db.rpc("queue_waitlist_batch", { p_campaign: CAMPAIGN, p_by: staff.email, p_limit: limit });
  if (error) back({ error: error.message });

  revalidatePath("/broadcast");
  back({ queued: "live" });
}
