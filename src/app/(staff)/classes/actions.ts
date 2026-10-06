"use server";

import { revalidatePath } from "next/cache";
import { fail, friendly, ok } from "@/lib/action-result";
import { staffOrThrow } from "@/lib/auth";

export async function checkInBooking(token: string) {
  const { supabase } = await staffOrThrow("admin", "lead", "facilitator", "security");
  const { data, error } = await supabase.rpc("check_in", { p_token: token });
  if (error) return { ...fail(friendly(error)), at: null };
  revalidatePath("/classes");
  revalidatePath(`/t/${token}`);
  return { ...ok("Checked in"), at: data as string };
}

/** For a tap by mistake. RLS lets the session's facilitator, leads and admins do this. */
export async function undoCheckIn(registrationId: string, token: string) {
  const { supabase } = await staffOrThrow("admin", "lead", "facilitator");
  const { data, error } = await supabase
    .from("registrations")
    .update({ checked_in_at: null, checked_in_by: null })
    .eq("id", registrationId)
    .select("id");
  if (error) return fail(friendly(error));
  if (!data?.length) return fail("You don’t have access to change this.");
  revalidatePath("/classes");
  revalidatePath(`/t/${token}`);
  return ok("Check-in undone");
}
