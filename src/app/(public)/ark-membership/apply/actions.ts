"use server";

import { type ActionResult, fail, field, friendly, ok } from "@/lib/action-result";
import { getViewer } from "@/lib/auth";

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
  const { error } = await supabase.rpc("apply_for_membership", {
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
  return ok("Application received");
}
