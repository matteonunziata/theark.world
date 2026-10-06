"use server";

import { type ActionResult, fail, field, friendly, ok } from "@/lib/action-result";
import { getViewer } from "@/lib/auth";
import { notifyLater } from "@/lib/slack";
import { applicationMessage } from "@/lib/slack-format";

const list = (data: FormData, name: string) =>
  data
    .getAll(name)
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean)
    .slice(0, 10);

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
