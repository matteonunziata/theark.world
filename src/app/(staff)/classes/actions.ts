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

export type MemberHit = { id: string; name: string; photo_path: string | null; tier: string | null };

/** Members a facilitator can add to their own session. */
export async function searchMembers(offeringId: string, date: string, query: string): Promise<MemberHit[]> {
  const { supabase } = await staffOrThrow("admin", "lead", "facilitator");
  const { data } = await supabase.rpc("search_members_for_class", {
    p_offering_id: offeringId,
    p_date: date,
    p_query: query,
  });
  return data ?? [];
}

export async function addMemberToSession(offeringId: string, date: string, contactId: string) {
  const { supabase } = await staffOrThrow("admin", "lead", "facilitator");
  const { error } = await supabase.rpc("add_member_to_session", {
    p_offering_id: offeringId,
    p_date: date,
    p_contact_id: contactId,
  });
  if (error) return fail(friendly(error));
  revalidatePath(`/classes/${offeringId}/${date}`);
  revalidatePath("/classes");
  return ok("Added to the class");
}
