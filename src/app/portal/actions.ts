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
import { sendGuestPassEmail, siteUrl } from "@/lib/email";
import { fmtDate } from "@/lib/dates";
import { sendGuestPassWhatsApp } from "@/lib/whatsapp";
import { notifyLater } from "@/lib/slack";
import { stripeReady } from "@/lib/stripe";
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
): Promise<ActionResult & { token?: string; emailed?: boolean; whatsapped?: boolean }> {
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

  // The pass goes out by itself, to whichever of email and WhatsApp the member gave.
  const phone = field(data, "phone");
  const { data: org } = await v.supabase.rpc("public_org").maybeSingle();
  const orgName = org?.name ?? "The ARK";
  const host = me?.name ?? "A member";
  let emailed = false;
  let whatsapped = false;
  if (date) {
    [emailed, whatsapped] = await Promise.all([
      email ? sendGuestPassEmail({ to: email, guest: name ?? "", host, date, token, orgName }) : false,
      phone
        ? siteUrl().then((origin) =>
            sendGuestPassWhatsApp({
              phone,
              guest: name ?? "",
              host,
              day: fmtDate(date, { weekday: "long", month: "long", day: "numeric" }),
              url: `${origin}/g/${token}`,
            }),
          )
        : false,
    ]);
  }
  revalidatePath("/portal/guests");
  const via = [emailed && "email", whatsapped && "WhatsApp"].filter(Boolean).join(" and ");
  return {
    ...ok(via ? `Invited. We sent ${name} their pass by ${via}.` : "Invited. Send them their pass."),
    token,
    emailed,
    whatsapped,
  };
}

export async function cancelGuest(id: string) {
  const v = await viewer();
  const { error } = await v.supabase.rpc("cancel_guest", { p_id: id });
  if (error) return fail(friendly(error));
  revalidatePath("/portal/guests");
  return ok("Invite cancelled. The pass is back in your allowance.");
}

/**
 * Book a court from the portal. Members pay when they book (their tier's
 * discount applied): the slot is held and they go to Stripe. While Stripe
 * isn't set up, it's booked and settled at reception.
 */
export async function bookCourt(courtId: string, date: string, start: string): Promise<ActionResult & { payUrl?: string }> {
  const v = await viewer();
  if (!v.memberId) return fail("Court booking is for members.");
  const [{ data: me }, { data: court }] = await Promise.all([
    v.supabase.rpc("my_member_profile").maybeSingle(),
    v.supabase.from("courts").select("slot_minutes").eq("id", courtId).maybeSingle(),
  ]);
  if (!me?.email) return fail("Add your email under Me first.");
  const online = stripeReady();
  const { data, error } = await v.supabase.rpc("hold_court", {
    p: {
      court_id: courtId,
      date,
      start,
      minutes: court?.slot_minutes ?? 60,
      name: me.name,
      email: me.email,
      phone: me.phone ?? "",
      pay: online ? "online" : "reception",
    },
  });
  if (error || !data) return fail(friendly(error));
  const h = data as { token: string; player_token: string; amount: number; status: string };
  revalidatePath("/portal/schedule");
  revalidatePath("/events/courts");
  revalidatePath("/courts", "layout");
  if (h.status === "held") return { ...ok("Taking you to payment…"), payUrl: `/pay/court/${h.player_token}` };
  if (Number(h.amount) > 0) return ok("Booked. Settle it at reception when you arrive.");
  return ok("Booked.");
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

/** A new pass code for the signed-in member; the old QR stops working at once. */
export async function replaceMyPass(): Promise<ActionResult> {
  const v = await viewer();
  if (!v.memberId) return fail("Only members have a member pass.");
  const { error } = await v.supabase.rpc("rotate_my_pass_token");
  if (error) return fail(friendly(error));
  revalidatePath("/portal", "layout");
  return ok("You have a new pass code. Save the new one to your photos.");
}
