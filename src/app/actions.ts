"use server";

import { redirect } from "next/navigation";
import { userClient } from "@/lib/supabase-server";

export async function signOut(): Promise<void> {
  const supabase = await userClient();
  await supabase.auth.signOut();
  redirect("/login");
}
