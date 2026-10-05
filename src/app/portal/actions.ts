"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  type ActionResult,
  fail,
  field,
  friendly,
  ok,
} from "@/lib/action-result";
import { getViewer } from "@/lib/auth";
import { sendGuestPassEmail } from "@/lib/email";
import { CITY_COOKIE } from "@/lib/portal";

async function viewer() {
  const v = await getViewer();
  if (!v.memberId && !v.staff) throw new Error("Sign in to the members portal.");
  return v;
}

export async function setCity(cityId: string) {
  const v = await viewer();
  (await cookies()).set(CITY_COOKIE, cityId, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  if (v.memberId) {
    const { error } = await v.supabase.rpc("set_my_city", { p_city_id: cityId });
    if (error) return fail(friendly(error));
  }
  revalidatePath("/portal", "layout");
  return ok("City updated");
}

export async function saveProfile(_prev: ActionResult, data: FormData): Promise<ActionResult> {
  const v = await viewer();
  if (!v.memberId) return fail("Only members have a member profile.");
  const { error } = await v.supabase.rpc("update_my_profile", {
    p_bio: field(data, "bio"),
    p_interests: (field(data, "interests") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 12),
    p_city_id: field(data, "city_id"),
    p_instagram: field(data, "instagram"),
    p_open_to_connect: data.get("open_to_connect") === "on",
    p_show_in_directory: data.get("show_in_directory") === "on",
  });
  if (error) return fail(friendly(error));
  revalidatePath("/portal", "layout");
  return ok("Profile saved");
}

export async function createPost(body: string, cityId: string | null, parentId: string | null) {
  const v = await viewer();
  const text = body.trim();
  if (!text) return fail("Write something first.");
  if (text.length > 2000) return fail("Keep it under 2,000 characters.");
  const { error } = await v.supabase.from("posts").insert({
    body: text,
    city_id: cityId,
    parent_id: parentId,
    ...(v.memberId ? { author_contact_id: v.memberId } : { author_staff_id: v.staff!.id }),
  });
  if (error) return fail(friendly(error));
  revalidatePath("/portal", "layout");
  return ok(parentId ? "Reply posted" : "Posted");
}

export async function deletePost(id: string) {
  const v = await viewer();
  const { error, count } = await v.supabase.from("posts").delete({ count: "exact" }).eq("id", id);
  if (error) return fail(friendly(error));
  if (!count) return fail("You can only remove your own posts.");
  revalidatePath("/portal", "layout");
  return ok("Removed");
}

export async function sendMessage(recipientId: string, body: string) {
  const v = await viewer();
  if (!v.memberId) return fail("Messages are between members.");
  const text = body.trim();
  if (!text) return fail("Write a message first.");
  const { data: allowed } = await v.supabase.rpc("can_message", { recipient: recipientId });
  if (!allowed) return fail("They aren’t taking new messages right now.");
  const { error } = await v.supabase
    .from("messages")
    .insert({ sender_id: v.memberId, recipient_id: recipientId, body: text });
  if (error) return fail(friendly(error));
  revalidatePath("/portal/messages", "layout");
  return ok("Sent");
}

export async function markRead(otherId: string) {
  const v = await viewer();
  if (!v.memberId) return;
  await v.supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", v.memberId)
    .eq("sender_id", otherId)
    .is("read_at", null);
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

  let emailed = false;
  if (email && date) {
    const [{ data: me }, { data: org }] = await Promise.all([
      v.supabase.rpc("my_member_profile").maybeSingle(),
      v.supabase.rpc("public_org").maybeSingle(),
    ]);
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
  revalidatePath("/portal/courts");
  revalidatePath("/events/courts");
  return ok("Booked. See you on the court.");
}

export async function cancelCourt(id: string) {
  const v = await viewer();
  const { error } = await v.supabase.rpc("cancel_court_booking", { p_id: id });
  if (error) return fail(friendly(error));
  revalidatePath("/portal/courts");
  revalidatePath("/events/courts");
  return ok("Booking cancelled.");
}

export async function setPhoto(path: string | null) {
  const v = await viewer();
  if (!v.memberId) return fail("Only members have a profile photo.");
  const { error } = await v.supabase.rpc("set_my_photo", { p_path: path });
  if (error) return fail(friendly(error));
  revalidatePath("/portal/me");
  return ok(path ? "Photo saved" : "Photo removed");
}
