"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { serviceClient } from "@/lib/supabase";
import { currentStaff } from "@/lib/supabase-server";
import { ANNOUNCE, MAX_MESSAGE, normalisePhone } from "@/lib/broadcast";

/*
 * The admin never sends anything itself. It writes a broadcast, its words
 * and its recipients; the API's broadcast loop picks them up within about
 * fifteen seconds (API migrations 0029, 0061). Each action ends in a redirect
 * with the outcome in the address, so the page needs no client code to report it.
 */

const back = (params: Record<string, string>) => redirect(`/broadcast?${new URLSearchParams(params).toString()}`);

/** The words and channels, checked the same way for a test and the real send. */
function compose(form: FormData): { subject: string; message: string; channels: string[] } {
  const subject = String(form.get("subject") ?? "").trim().slice(0, 120);
  const message = String(form.get("message") ?? "").replace(/\r\n?/g, "\n").trim();
  const channels = ["whatsapp", "email"].filter((c) => form.get(c) === "on");
  if (!message) back({ error: "Write the message first." });
  if (message.length > MAX_MESSAGE) back({ error: `Keep the message under ${MAX_MESSAGE} characters.` });
  if (!channels.length) back({ error: "Choose WhatsApp, email, or both." });
  if (channels.includes("email") && !subject) back({ error: "Give the email a subject." });
  return { subject, message, channels };
}

export async function sendTest(form: FormData): Promise<void> {
  const staff = await currentStaff();
  if (!staff) redirect("/login");
  if (staff.role !== "admin") back({ error: "Only an admin can send a test." });
  const { subject, message, channels } = compose(form);

  const phoneTyped = String(form.get("phone") ?? "").trim();
  const emailTyped = String(form.get("email_to") ?? "").trim().toLowerCase();
  const phone = phoneTyped ? normalisePhone(phoneTyped) : null;
  if (phoneTyped && !phone) back({ error: `“${phoneTyped}” is not a phone number we can send to.` });
  const email = emailTyped || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) back({ error: `“${emailTyped}” is not an email address.` });
  if (!phone && !email) back({ error: "Give a phone number, an email address, or both, for the test." });

  const db = serviceClient();
  // The user behind the number, if any, so the test follows their window like the real send.
  const { data: who } = phone
    ? await db.from("users").select("id").eq("wa_phone", phone.replace(/^\+/, "")).maybeSingle()
    : { data: null };

  const { data, error } = await db
    .from("broadcasts")
    .insert({ campaign: ANNOUNCE, kind: "test", channels, subject, message, created_by: staff.email })
    .select("id")
    .single();
  if (error || !data) back({ error: `Could not queue the test: ${error?.message ?? "no row"}` });

  const { error: rErr } = await db.from("broadcast_recipients").insert({
    broadcast_id: data!.id,
    user_id: (who?.id as string | undefined) ?? null,
    phone,
    email,
    wa_status: phone && channels.includes("whatsapp") ? "pending" : "skipped",
    email_status: email && channels.includes("email") ? "pending" : "skipped",
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
  if (staff.role !== "admin") back({ error: "Only an admin can send to every user." });
  const { subject, message, channels } = compose(form);

  // Typed, not clicked: this cannot be taken back.
  if (String(form.get("confirm") ?? "").trim().toUpperCase() !== "SEND") {
    back({ error: "Type SEND in the box to confirm. Nothing was sent." });
  }

  const db = serviceClient();
  // Everybody it goes to: finished setup, active, said yes to updates, not since said stop.
  const users: { id: string; wa_phone: string; email: string | null; email_verified_at: string | null }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("users")
      .select("id, wa_phone, email, email_verified_at")
      .is("deleted_at", null)
      .eq("status", "active")
      .not("consented_at", "is", null)
      .not("updates_opt_in_at", "is", null)
      .is("updates_off_at", null)
      .order("id")
      .range(from, from + 999);
    if (error) back({ error: `Could not read the users: ${error.message}` });
    users.push(...((data ?? []) as typeof users));
    if (!data || data.length < 1000) break;
  }
  if (!users.length) back({ error: "Nobody to send to yet." });

  const { data: b, error } = await db
    .from("broadcasts")
    .insert({ campaign: ANNOUNCE, kind: "live", channels, subject, message, created_by: staff.email })
    .select("id")
    .single();
  if (error || !b) back({ error: `Could not queue it: ${error?.message ?? "no row"}` });

  const rows = users.map((u) => {
    const email = u.email && u.email_verified_at ? u.email : null;
    return {
      broadcast_id: b!.id,
      user_id: u.id,
      phone: `+${u.wa_phone.replace(/\D/g, "")}`,
      email,
      wa_status: channels.includes("whatsapp") ? "pending" : "skipped",
      email_status: email && channels.includes("email") ? "pending" : "skipped",
    };
  });
  for (let i = 0; i < rows.length; i += 500) {
    const { error: rErr } = await db.from("broadcast_recipients").insert(rows.slice(i, i + 500));
    if (rErr) {
      await db.from("broadcasts").update({ status: "failed", note: rErr.message }).eq("id", b!.id);
      back({ error: `Could not queue it: ${rErr.message}` });
    }
  }

  revalidatePath("/broadcast");
  back({ queued: "live" });
}
