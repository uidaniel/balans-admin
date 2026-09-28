"use server";

import { revalidatePath } from "next/cache";
import { serviceClient } from "@/lib/supabase";
import { currentStaff } from "@/lib/supabase-server";

export type RemoveResult = { ok: true; who: string } | { ok: false; message: string };

/**
 * Takes one person off the waitlist, for good.
 *
 * Deleted rather than marked: somebody who asks to be taken off expects to be
 * gone, and a row kept "just in case" is personal data we have no reason to
 * hold. What was removed is written to `audit_log` — who, by whom, and when,
 * but not their number or address, for the same reason.
 *
 * Admins only. Support staff can see the list but not change it.
 */
export async function removeFromWaitlist(id: string): Promise<RemoveResult> {
  const staff = await currentStaff();
  if (!staff) return { ok: false, message: "You are signed out. Sign in again and retry." };
  if (staff.role !== "admin") return { ok: false, message: "Only an admin can remove someone from the waitlist." };
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, message: "That entry could not be found." };

  const db = serviceClient();
  const { data, error } = await db.from("waitlist").delete().eq("id", id).select("id, phone, email").maybeSingle();
  if (error) return { ok: false, message: `Could not remove them: ${error.message}` };
  if (!data) return { ok: false, message: "They were already off the list." };

  await db.from("audit_log").insert({
    actor_type: "staff",
    actor_id: staff.email,
    action: "waitlist.remove",
    target_type: "waitlist",
    target_id: id,
  });

  revalidatePath("/waitlist");
  revalidatePath("/");
  revalidatePath("/broadcast");
  return { ok: true, who: (data.phone as string | null) ?? (data.email as string | null) ?? "That entry" };
}
