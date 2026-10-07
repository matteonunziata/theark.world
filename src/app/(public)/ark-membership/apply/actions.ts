"use server";

import { type ActionResult, fail, field, friendly, ok } from "@/lib/action-result";
import { getViewer } from "@/lib/auth";
import { fmtDate } from "@/lib/dates";
import { sendPassEmail, siteUrl } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyLater } from "@/lib/slack";
import { applicationMessage } from "@/lib/slack-format";

const list = (data: FormData, name: string) =>
  data
    .getAll(name)
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean)
    .slice(0, 10);

/**
 * Email the free day pass that came with an application (see
 * public.apply_for_membership). Only for a pass made just now, so a double
 * submit doesn't send it twice.
 */
async function emailFreePass(applicationId: string | null) {
  const admin = createAdminClient();
  if (!admin || !applicationId) return;
  const { data: a } = await admin
    .from("membership_applications")
    .select("free_pass_id, contact:contacts(name, email, pass_token)")
    .eq("id", applicationId)
    .maybeSingle();
  if (!a?.free_pass_id) return;
  const { data: pass } = await admin
    .from("memberships")
    .select("activate_by, created_at")
    .eq("id", a.free_pass_id)
    .maybeSingle();
  if (!a.contact?.email || !pass?.activate_by) return;
  if (Date.now() - new Date(pass.created_at).getTime() > 2 * 60_000) return;
  const [origin, { data: org }] = await Promise.all([siteUrl(), admin.rpc("public_org").maybeSingle()]);
  await sendPassEmail({
    to: a.contact.email,
    name: a.contact.name,
    what: "Day Pass",
    days: 1,
    useBy: fmtDate(pass.activate_by, { weekday: "long", month: "long", day: "numeric" }),
    url: `${origin}/p/${a.contact.pass_token}`,
    orgName: org?.name ?? "The ARK",
    free: true,
  });
}

/** Send a membership application into the CRM (see public.apply_for_membership). */
export async function applyForMembership(_prev: ActionResult, data: FormData): Promise<ActionResult> {
  // A hidden field people don't see; bots tend to fill it in.
  if (field(data, "website")) return ok("Application received");
  const { supabase } = await getViewer();
  const { data: contactId, error } = await supabase.rpc("apply_for_membership", {
    p_first: field(data, "first_name") ?? "",
    p_last: field(data, "last_name") ?? "",
    p_email: field(data, "email") ?? "",
    p_phone: field(data, "phone") ?? "",
    p_plan: field(data, "plan") ?? "",
    p_invited_by: field(data, "invited_by") ?? "",
    p_building: field(data, "building") ?? "",
    p_why: field(data, "why_join") ?? "",
    p_contributing: field(data, "contributing") ?? "",
    p_drawn_to: list(data, "drawn_to"),
    p_invites: list(data, "invite"),
    p_source: field(data, "utm_source")?.slice(0, 120) ?? "",
    p_medium: field(data, "utm_medium")?.slice(0, 120) ?? "",
    p_campaign: field(data, "utm_campaign")?.slice(0, 120) ?? "",
    p_tried_day_pass: field(data, "tried_day_pass") === "yes",
  });
  if (error) return fail(friendly(error));

  // Their free day pass, by email (never blocks the application).
  await emailFreePass(contactId ?? null).catch((e) => console.error("Free pass email failed", e));

  // Tell the team on Slack, once the response is out.
  const a = {
    name: `${field(data, "first_name") ?? ""} ${field(data, "last_name") ?? ""}`.trim(),
    email: field(data, "email") ?? "",
    phone: field(data, "phone"),
    plan: field(data, "plan") ?? "",
    invitedBy: field(data, "invited_by"),
    why: field(data, "why_join"),
    contactId: contactId ?? null,
  };
  notifyLater("application", (origin) => applicationMessage(a, origin), { contact_id: contactId ?? null });
  return ok("Application received");
}
