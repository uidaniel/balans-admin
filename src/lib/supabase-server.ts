import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { publicConfig, serviceClient } from "./supabase";

/**
 * The signed-in visitor's own client, backed by the session cookie.
 *
 * It carries the anon key, so it can only ever see what row level security
 * allows — which for `waitlist` is nothing. It answers "who is this?", never
 * "what may they read?".
 */
export async function userClient(): Promise<SupabaseClient> {
  const { url, anonKey } = publicConfig();
  const store = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Called from a Server Component, where cookies are read-only. The
          // callback route and server actions do the writing; ignoring it here
          // is the documented pattern, not a swallowed error.
        }
      },
    },
  });
}

export type Staff = { id: string; email: string; role: "admin" | "support" };

/**
 * Who is signed in, and are they staff?
 *
 * Two separate questions on purpose. Anyone can create a Supabase Auth account
 * if sign-ups are open; being signed in must not by itself grant admin. The
 * allowlist is the gate, and it is read with the service key so the visitor's
 * own permissions cannot influence the answer.
 */
export type Access =
  | { kind: "anonymous" }
  /** Signed in, but not on the allowlist. Carries the id needed to add them. */
  | { kind: "not_staff"; authUserId: string; email: string }
  | { kind: "staff"; staff: Staff };

export async function access(): Promise<Access> {
  const supabase = await userClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { kind: "anonymous" };

  const { data, error } = await serviceClient()
    .from("admin_allowlist")
    .select("auth_user_id, email, role")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[admin] allowlist lookup failed", error);
    return { kind: "not_staff", authUserId: user.id, email: user.email ?? "" };
  }

  // Not on the allowlist yet, but perhaps invited by email (API migration 0052).
  if (!data) {
    const claimed = await claimInvite(user.id, user.email ?? null, Boolean(user.email_confirmed_at));
    if (claimed) return { kind: "staff", staff: claimed };
  }

  // Signed in and unknown is its own outcome, not the same as signed out.
  // Sending this case back to the login page would loop forever: the link
  // works, the allowlist does not have them, and they land on login again.
  if (!data) return { kind: "not_staff", authUserId: user.id, email: user.email ?? "" };

  return {
    kind: "staff",
    staff: { id: user.id, email: data.email as string, role: data.role as Staff["role"] },
  };
}

/**
 * An invite turned into an allowlist row, the first time its address signs in.
 *
 * Only for a confirmed address: a magic link is the proof that this person
 * owns it, and without that proof an invite is somebody else's. The invite is
 * marked claimed, so the same address signing up again under a new account
 * later does not inherit it; a second person needs a second invite.
 */
async function claimInvite(authUserId: string, email: string | null, confirmed: boolean): Promise<Staff | null> {
  if (!email || !confirmed) return null;
  const address = email.trim().toLowerCase();
  const db = serviceClient();

  const { data: invite, error } = await db
    .from("admin_invites")
    .select("email, role")
    .eq("email", address)
    .is("claimed_at", null)
    .maybeSingle();
  if (error) {
    console.error("[admin] invite lookup failed", error);
    return null;
  }
  if (!invite) return null;

  const role = invite.role as Staff["role"];
  const { error: added } = await db
    .from("admin_allowlist")
    .upsert({ auth_user_id: authUserId, email: address, role }, { onConflict: "auth_user_id" });
  if (added) {
    console.error("[admin] could not add an invited address to the allowlist", added);
    return null;
  }
  await db
    .from("admin_invites")
    .update({ claimed_at: new Date().toISOString(), claimed_by: authUserId })
    .eq("email", address)
    .is("claimed_at", null);

  return { id: authUserId, email: address, role };
}

export async function currentStaff(): Promise<Staff | null> {
  const a = await access();
  return a.kind === "staff" ? a.staff : null;
}
