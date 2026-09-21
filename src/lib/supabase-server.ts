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

  // Signed in and unknown is its own outcome, not the same as signed out.
  // Sending this case back to the login page would loop forever: the link
  // works, the allowlist does not have them, and they land on login again.
  if (!data) return { kind: "not_staff", authUserId: user.id, email: user.email ?? "" };

  return {
    kind: "staff",
    staff: { id: user.id, email: data.email as string, role: data.role as Staff["role"] },
  };
}

export async function currentStaff(): Promise<Staff | null> {
  const a = await access();
  return a.kind === "staff" ? a.staff : null;
}
