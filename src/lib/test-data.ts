import { serviceClient } from "@/lib/supabase";

/*
 * Test data, kept out of the numbers (5 November 2026; API migration 0074).
 *
 * People tried Balans on live: invoices to themselves, clients called "test",
 * a ₦10,000,000 invoice. An account marked as a test, or a single invoice
 * left out, no longer counts in any total. What looks like a test is listed
 * with why (admin_suspect_documents) for a person to decide; no rule marks
 * anything by itself.
 */

export type Suspect = {
  document_id: string;
  user_id: string;
  number: number | null;
  type: string;
  total_kobo: number;
  created_at: string;
  client_name: string | null;
  business_name: string | null;
  reasons: string[];
};

export type TestAccount = { id: string; business_name: string | null; wa_phone: string; created_at: string };
export type LeftOut = {
  id: string;
  number: number | null;
  type: string;
  total_kobo: number;
  user_id: string;
  users: { business_name: string | null } | null;
  clients: { name: string } | null;
};

export type TestData = { suspects: Suspect[]; accounts: TestAccount[]; leftOut: LeftOut[] };

/** True when the columns and views are not there yet: the API ships them. */
export const notYet = (error: string | null | undefined) => Boolean(error && /does not exist|schema cache|Could not find/i.test(error));

export async function loadTestData(): Promise<{ data: TestData | null; error: string | null }> {
  const sb = serviceClient();
  const [suspects, accounts, leftOut] = await Promise.all([
    sb.from("admin_suspect_documents").select("*").order("created_at", { ascending: false }).limit(300),
    sb.from("users").select("id, business_name, wa_phone, created_at").eq("is_test", true).is("deleted_at", null).order("created_at"),
    sb
      .from("documents")
      .select("id, number, type, total_kobo, user_id, users(business_name), clients(name)")
      .eq("left_out", true)
      .order("created_at", { ascending: false })
      .limit(300),
  ]);
  const error = suspects.error?.message ?? accounts.error?.message ?? leftOut.error?.message ?? null;
  if (error) return { data: null, error };
  return {
    data: {
      suspects: (suspects.data ?? []) as Suspect[],
      accounts: (accounts.data ?? []) as TestAccount[],
      leftOut: (leftOut.data ?? []) as unknown as LeftOut[],
    },
    error: null,
  };
}

/** How much is being left out, for the line on the Overview and Analytics. */
export async function loadLeftOutCounts(): Promise<{ accounts: number; invoices: number } | null> {
  const sb = serviceClient();
  const [a, d] = await Promise.all([
    sb.from("users").select("id", { count: "exact", head: true }).eq("is_test", true).is("deleted_at", null),
    sb.from("documents").select("id", { count: "exact", head: true }).eq("left_out", true),
  ]);
  if (a.error || d.error) return null;
  return { accounts: a.count ?? 0, invoices: d.count ?? 0 };
}

export type SetupStep = { step: string; people: number };

export async function loadSetupSteps(): Promise<{ data: SetupStep[] | null; error: string | null }> {
  const { data, error } = await serviceClient().from("admin_setup_steps").select("step, people");
  return error ? { data: null, error: error.message } : { data: (data ?? []) as SetupStep[], error: null };
}
