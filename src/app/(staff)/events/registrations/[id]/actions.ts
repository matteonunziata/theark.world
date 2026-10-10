"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, fail, field, friendly, ok } from "@/lib/action-result";
import { staffOrThrow } from "@/lib/auth";
import { sendTicketEmail } from "@/lib/email";

const refresh = () => {
  revalidatePath("/events", "layout");
  revalidatePath("/e", "layout");
};

/** Add a booking by hand, or change one. Checks happen in staff_save_registration. */
export async function saveRegistration(_prev: ActionResult, data: FormData): Promise<ActionResult> {
  const { supabase } = await staffOrThrow("admin", "lead", "facilitator");
  const offeringId = field(data, "offering_id");
  const registrationId = field(data, "registration_id");
  const date = field(data, "session_date");
  if (!offeringId) return fail("Pick an event.");
  if (!date) return fail("Pick a date.");

  const items = [...data.entries()]
    .filter(([k]) => k.startsWith("qty_"))
    .map(([k, v]) => ({ ticket_type_id: k.slice(4), qty: Math.max(0, Math.round(Number(v) || 0)) }))
    .filter((i) => i.qty > 0);

  const { data: saved, error } = await supabase
    .rpc("staff_save_registration", {
      p_offering_id: offeringId,
      p_registration_id: registrationId ?? undefined,
      p_session_date: date,
      p_name: field(data, "name") ?? "",
      p_email: field(data, "email") ?? "",
      p_phone: field(data, "phone") ?? "",
      p_items: items,
      // Editing keeps the payment as it is unless the box is there to change it.
      p_paid: data.get("paid") === "on",
      p_override: data.get("override") === "on",
    })
    .single();
  if (error || !saved) return fail(friendly(error));

  const name = field(data, "name") ?? "";
  const email = field(data, "email")?.toLowerCase() ?? null;
  let sent = false;
  if (!registrationId && email && data.get("send") === "on") {
    const [{ data: o }, { data: org }] = await Promise.all([
      supabase.from("offerings").select("title, start_time, end_time, location").eq("id", offeringId).single(),
      supabase.rpc("public_org").maybeSingle(),
    ]);
    if (o) {
      sent = await sendTicketEmail({
        to: email,
        holder: name,
        title: o.title,
        sessionDate: date,
        startTime: o.start_time,
        endTime: o.end_time,
        location: o.location,
        token: saved.qr_token,
        orgName: org?.name ?? "The ARK",
      });
    }
  }
  refresh();
  return ok(registrationId ? "Booking updated" : sent ? `${name} added, ticket emailed` : `${name} added`);
}

/** Cancel a booking (frees its spots and tickets) or bring it back. */
export async function setCancelled(registrationId: string, cancelled: boolean) {
  const { supabase } = await staffOrThrow("admin", "lead", "facilitator");
  const { error } = await supabase.rpc("staff_set_registration_cancelled", {
    p_registration_id: registrationId,
    p_cancelled: cancelled,
  });
  if (error) return fail(friendly(error));
  refresh();
  return ok(cancelled ? "Booking cancelled" : "Booking restored");
}
