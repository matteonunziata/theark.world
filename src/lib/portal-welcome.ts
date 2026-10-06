import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { portalWelcomeTier } from "@/lib/crm";
import type { Database } from "@/lib/database.types";
import { emailConfigured, sendPortalWelcomeEmail, siteUrl } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/admin";

type Sb = SupabaseClient<Database>;

export type WelcomeResult = { sent: true; email: string } | { sent: false; reason: string };

/**
 * Email a member their way into the portal, once their membership (a month
 * or longer) is active. Runs as the staff member saving the contact, so RLS
 * decides what they can see and stamp. With the service role key the email
 * carries a sign-in link; without it, a link to the sign-in page.
 */
export async function sendPortalWelcome(
  sb: Sb,
  contactId: string,
  { force = false } = {},
): Promise<WelcomeResult> {
  const { data: c } = await sb
    .from("contacts")
    .select("id, name, email, tier, membership_status, welcome_sent_at")
    .eq("id", contactId)
    .maybeSingle();
  if (!c) return { sent: false, reason: "Person not found." };
  if (!c.email) return { sent: false, reason: "They have no email address." };
  // A membership paid for but starting later counts: they can set up their profile now.
  if (!c.tier || !["active", "upcoming"].includes(c.membership_status)) {
    return { sent: false, reason: "Their membership isn’t active." };
  }
  const { data: tier } = await sb.from("membership_tiers").select("key, period").eq("key", c.tier).maybeSingle();
  if (!portalWelcomeTier(tier)) return { sent: false, reason: "Only memberships of a month or longer get the welcome email." };
  if (c.welcome_sent_at && !force) return { sent: false, reason: "Already sent." };
  if (!emailConfigured()) return { sent: false, reason: "Email isn’t set up (RESEND_API_KEY)." };

  const origin = await siteUrl();
  const next = "/portal/welcome";
  let link = `${origin}/portal/login?next=${encodeURIComponent(next)}`;
  let signsIn = false;
  const admin = createAdminClient();
  if (admin) {
    const { data, error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: c.email,
      options: { redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (!error && data.properties?.action_link) {
      link = data.properties.action_link;
      signsIn = true;
    } else if (error) {
      console.error("welcome generateLink failed", error);
    }
  }
  const { data: org } = await sb.rpc("public_org").maybeSingle();
  const ok = await sendPortalWelcomeEmail({
    to: c.email,
    name: c.name,
    link,
    signsIn,
    orgName: org?.name ?? "The ARK",
  });
  if (!ok) return { sent: false, reason: "The email didn’t go out. Try again in a minute." };
  await sb.from("contacts").update({ welcome_sent_at: new Date().toISOString() }).eq("id", c.id);
  return { sent: true, email: c.email };
}
