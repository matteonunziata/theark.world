"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  type ActionResult,
  fail,
  field,
  friendly,
  ok,
} from "@/lib/action-result";
import { getViewer } from "@/lib/auth";
import { splitList } from "@/lib/connect";
import { sendGuestPassEmail } from "@/lib/email";
import { notifyLater } from "@/lib/slack";
import { guestMessage } from "@/lib/slack-format";

async function viewer() {
  const v = await getViewer();
  if (!v.memberId && !v.staff) throw new Error("Sign in to the members portal.");
  return v;
}

export async function saveProfile(_prev: ActionResult, data: FormData): Promise<ActionResult> {
  const v = await viewer();
  if (!v.memberId) return fail("Only members have a member profile.");
  const { error } = await v.supabase.rpc("update_my_profile", {
    p_name: field(data, "name") ?? "",
    p_phone: field(data, "phone"),
    p_bio: field(data, "bio"),
    p_interests: splitList(field(data, "interests")),
    p_cities: splitList(field(data, "cities"), 8),
    p_instagram: field(data, "instagram"),
    p_open_to_connect: data.get("open_to_connect") === "on",
    p_show_in_directory: data.get("show_in_directory") === "on",
  });
  if (error) return fail(friendly(error));
  revalidatePath("/portal", "layout");
  return ok("Profile saved");
}

/** The quick set-up after the welcome email. Lands on Home when done. */
export async function completeOnboarding(_prev: ActionResult, data: FormData): Promise<ActionResult> {
  const v = await viewer();
  if (!v.memberId) return fail("Only members have a member profile.");
  const { error } = await v.supabase.rpc("complete_my_onboarding", {
    p_name: field(data, "name") ?? "",
    p_phone: field(data, "phone"),
    p_instagram: field(data, "instagram"),
    p_bio: field(data, "bio"),
    p_cities: splitList(field(data, "cities"), 8),
    p_open_to_connect: data.get("open_to_connect") === "on",
  });
  if (error) return fail(friendly(error));
  revalidatePath("/portal", "layout");
  redirect("/portal");
}

export async function inviteGuest(
  _prev: ActionResult & { token?: string },
  data: FormData,
): Promise<ActionResult & { token?: string; emailed?: boolean }> {
  const v = await viewer();
  if (!v.memberId) return fail("Only members can invite guests.");
  const name = field(data, "guest_name");
  const email = field(data, "email");
  const date = field(data, "visit_date");
  const { data: token, error } = await v.supabase.rpc("invite_guest", {
    p_name: name ?? "",
    p_phone: field(data, "phone"),
    p_email: email,
    p_visit_date: date ?? "",
  });
  if (error || !token) return fail(friendly(error));

  const { data: me } = await v.supabase.rpc("my_member_profile").maybeSingle();
  if (date) {
    const g = { guest: name ?? "", host: me?.name ?? "A member", date };
    notifyLater("guest", (origin) => guestMessage(g, origin));
  }

  let emailed = false;
  if (email && date) {
    const { data: org } = await v.supabase.rpc("public_org").maybeSingle();
    emailed = await sendGuestPassEmail({
      to: email,
      guest: name ?? "",
      host: me?.name ?? "A member",
      date,
      token,
      orgName: org?.name ?? "The ARK",
    });
  }
  revalidatePath("/portal/guests");
  return { ...ok(emailed ? `Invited. We emailed ${name} their pass.` : "Invited. Send them their pass."), token, emailed };
}

export async function cancelGuest(id: string) {
  const v = await viewer();
  const { error } = await v.supabase.rpc("cancel_guest", { p_id: id });
  if (error) return fail(friendly(error));
  revalidatePath("/portal/guests");
  return ok("Invite cancelled. The pass is back in your allowance.");
}

export async function bookCourt(courtId: string, date: string, start: string) {
  const v = await viewer();
  if (!v.memberId) return fail("Court booking is for members.");
  const { error } = await v.supabase.rpc("book_court", { p_court: courtId, p_date: date, p_start: start });
  if (error) return fail(friendly(error));
  revalidatePath("/portal/schedule");
  revalidatePath("/events/courts");
  return ok("Booked. Pay from your bookings above, or settle at reception.");
}

export async function cancelCourt(id: string) {
  const v = await viewer();
  const { error } = await v.supabase.rpc("cancel_court_booking", { p_id: id });
  if (error) return fail(friendly(error));
  revalidatePath("/portal/schedule");
  revalidatePath("/events/courts");
  return ok("Booking cancelled.");
}

export async function setPhoto(path: string | null) {
  const v = await viewer();
  if (!v.memberId) return fail("Only members have a profile photo.");
  const { error } = await v.supabase.rpc("set_my_photo", { p_path: path });
  if (error) return fail(friendly(error));
  revalidatePath("/portal", "layout");
  return ok(path ? "Photo saved" : "Photo removed");
}
