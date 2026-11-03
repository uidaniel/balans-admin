"use server";

import { redirect } from "next/navigation";
import { serviceClient } from "@/lib/supabase";
import { currentStaff } from "@/lib/supabase-server";
import { REASONS } from "./reasons";

/*
 * Showing one client's contact details in full (3 November 2026).
 *
 * The user is the controller of their clients' details and Balans the
 * processor (privacy notice, "Your clients' data"), so staff see them only
 * for a reason the notice names, and every look is written to `audit_log`
 * before anything is shown. The page shows the details only while a
 * matching row from the same person is fresh, so the address alone is not
 * a way round it.
 */

const UUID = /^[0-9a-f-]{36}$/i;

export async function revealClient(form: FormData): Promise<void> {
  const staff = await currentStaff();
  if (!staff) redirect("/login");

  const userId = String(form.get("user") ?? "");
  const clientId = String(form.get("client") ?? "");
  const reason = String(form.get("reason") ?? "");
  const note = String(form.get("note") ?? "").trim().slice(0, 200);
  if (!UUID.test(userId) || !UUID.test(clientId)) redirect("/users");
  const back = (q: string) => redirect(`/users/${userId}?${q}#clients`);

  if (staff.role !== "admin") back("reveal_error=Only+an+admin+can+see+a+client%27s+details.");
  if (!REASONS.some((r) => r.id === reason)) back("reveal_error=Choose+why+you+need+to+see+them.");

  const db = serviceClient();
  // The client has to be this user's, or the log would name the wrong account.
  const { data: client } = await db.from("clients").select("id").eq("id", clientId).eq("user_id", userId).maybeSingle();
  if (!client) back("reveal_error=That+client+is+not+on+this+account.");

  const { error } = await db.from("audit_log").insert({
    actor_type: "staff",
    actor_id: staff.email,
    action: "client.reveal",
    target_type: "client",
    target_id: clientId,
    after_json: { user_id: userId, reason, note: note || null },
  });
  // Not logged, not shown.
  if (error) back(`reveal_error=${encodeURIComponent(`Could not log it, so nothing is shown: ${error.message}`)}`);

  back(`shown=${clientId}`);
}
