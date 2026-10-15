"use server";

import { revalidatePath } from "next/cache";
import { fail, friendly, ok } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";

const refresh = (token: string) => {
  revalidatePath(`/t/${token}`);
  revalidatePath("/events", "layout");
};

/** A guest cancels their own booking from the link in their confirmation email. The token is the key. */
export async function cancelMyBooking(token: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("guest_cancel_booking", { p_token: token });
  if (error) return fail(friendly(error));
  refresh(token);
  return ok("Booking cancelled");
}

/** A guest moves their booking to another date of the same event; tickets and payment stay as they are. */
export async function moveMyBooking(token: string, date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail("Pick a date.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("guest_reschedule_booking", { p_token: token, p_session_date: date });
  if (error) return fail(friendly(error));
  refresh(token);
  return ok("Booking moved");
}
