"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, fail, friendly, ok } from "@/lib/action-result";
import { getViewer } from "@/lib/auth";

/** Security taps Let in on a scanned guest pass; it's used up by that. */
export async function letGuestIn(token: string): Promise<ActionResult> {
  const { supabase, staff } = await getViewer();
  if (!staff) return fail("Sign in as staff to let guests in.");
  const { error } = await supabase.rpc("use_guest_pass", { p_token: token });
  if (error) return fail(friendly(error));
  revalidatePath(`/g/${token}`);
  revalidatePath("/security");
  return ok("Guest let in");
}
