"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, fail, friendly, ok } from "@/lib/action-result";
import { staffOrThrow } from "@/lib/auth";

/** Admins fold a duplicate into the contact they keep. The database moves everything over. */
export async function mergeContacts(keepId: string, dropId: string): Promise<ActionResult> {
  const { supabase } = await staffOrThrow("admin");
  const { error } = await supabase.rpc("merge_contacts", { p_keep: keepId, p_drop: dropId });
  if (error) return fail(friendly(error));
  revalidatePath("/crm", "layout");
  revalidatePath("/estate", "layout");
  return ok("Merged");
}
