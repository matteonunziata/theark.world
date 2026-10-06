"use server";

import { type ActionResult, fail, field, friendly, ok } from "@/lib/action-result";
import { getViewer } from "@/lib/auth";
import { siteUrl } from "@/lib/email";
import { marketingEmailReady, runAutomation } from "@/lib/marketing-email";
import { notifyLater } from "@/lib/slack";
import { leadMessage } from "@/lib/slack-format";
import { createAdminClient } from "@/lib/supabase/admin";

const utm = (data: FormData, k: string) => field(data, k)?.slice(0, 120) ?? "";

/** Join the waitlist, keeping the UTM tags the person arrived with. */
export async function joinWaitlist(_prev: ActionResult, data: FormData): Promise<ActionResult> {
  // A hidden field people don't see; bots tend to fill it in.
  if (field(data, "website")) return ok("You’re on the list.");
  const { supabase } = await getViewer();
  const { data: contactId, error } = await supabase.rpc("join_waitlist", {
    p_name: field(data, "name") ?? "",
    p_email: field(data, "email") ?? "",
    p_phone: field(data, "phone") ?? "",
    p_brand: field(data, "brand") ?? "",
    p_source: utm(data, "utm_source"),
    p_medium: utm(data, "utm_medium"),
    p_campaign: utm(data, "utm_campaign"),
  });
  if (error) return fail(friendly(error));

  // Send the welcome now when we can; otherwise the scheduled run sends it.
  const admin = createAdminClient();
  if (admin && marketingEmailReady() && contactId) {
    try {
      await runAutomation(admin, await siteUrl(), contactId);
    } catch (e) {
      console.error("Waitlist welcome failed", e);
    }
  }
  const lead = {
    name: field(data, "name") ?? field(data, "email") ?? "Someone",
    email: field(data, "email"),
    phone: field(data, "phone"),
    via: "Waitlist",
    brand: field(data, "brand"),
    source: utm(data, "utm_source") || null,
    contactId: contactId ?? null,
  };
  notifyLater("lead", (origin) => leadMessage(lead, origin), { contact_id: contactId ?? null });
  return ok("You’re on the list.");
}
