"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, fail, friendly, ok } from "@/lib/action-result";
import { getViewer } from "@/lib/auth";

export async function logEntry(token: string): Promise<ActionResult> {
  const { supabase, staff } = await getViewer();
  if (!staff) return fail("Sign in as staff to log entries.");
  const { error } = await supabase.rpc("log_pass_entry", { p_token: token });
  if (error) return fail(friendly(error));
  revalidatePath(`/p/${token}`);
  return ok("Entry logged");
}
