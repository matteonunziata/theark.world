"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, fail, friendly, ok } from "@/lib/action-result";
import { getViewer } from "@/lib/auth";
import { passReason } from "@/lib/pass";

/** Security taps Check in on a scanned member pass. */
export async function checkInPass(token: string): Promise<ActionResult> {
  const { supabase, staff } = await getViewer();
  if (!staff) return fail("Sign in as staff to check people in.");
  const { data, error } = await supabase.rpc("gate_check_in", { p_token: token }).maybeSingle();
  if (error) return fail(friendly(error));
  revalidatePath(`/p/${token}`);
  if (!data?.ok) {
    return fail(
      data?.state === "not_found"
        ? "This code isn’t on any membership."
        : passReason({ state: data?.state ?? "inactive", tier_name: null, period: null, valid_from: null, valid_until: null, activate_by: null, checked_in_at: data?.entered_at }),
    );
  }
  return ok("Checked in");
}
