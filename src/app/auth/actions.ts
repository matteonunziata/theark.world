"use server";

import { emailConfigured, sendSignInEmail, siteUrl } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type SignInResult =
  | { status: "sent" }
  | { status: "fallback" }
  | { status: "error"; error: string };

/**
 * Send a sign-in link in the ARK email template. Needs Resend and the
 * Supabase service-role key; without them the form falls back to Supabase's
 * own email. The before-user-created hook guards account creation too, once
 * it is switched on in Supabase (Authentication, Hooks).
 *
 * One form for everyone: the email says who someone is. Anyone on the team
 * (staff and facilitators, any email domain) or on an active membership can
 * sign in, and `/` sends them to the right place.
 */
export async function sendSignInLink(rawEmail: string, next: string): Promise<SignInResult> {
  const email = rawEmail.trim().toLowerCase();
  if (!EMAIL.test(email)) return { status: "error", error: "Enter a valid email." };

  // The same rules as the sign-in hook, checked before any email goes out,
  // even when Supabase sends it: nobody outside the team or the membership
  // gets a link or a login.
  const supabase = await createClient();
  const { data: refusal, error: checkError } = await supabase.rpc("sign_in_check", { p_email: email });
  if (checkError) return { status: "error", error: "Couldn’t check that email. Try again in a minute." };
  if (refusal) return { status: "error", error: refusal };

  const admin = createAdminClient();
  if (!admin || !emailConfigured()) return { status: "fallback" };
  const { data: onTeam } = await admin
    .from("team_members")
    .select("id")
    .eq("email", email)
    .eq("status", "active")
    .maybeSingle();
  const team = !!onTeam;

  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: `${await siteUrl()}/auth/callback?next=${encodeURIComponent(safeNext)}` },
  });
  if (error || !data.properties?.action_link) {
    console.error("generateLink failed", error);
    return { status: "error", error: "Couldn’t make a sign-in link. Try again in a minute." };
  }
  const sent = await sendSignInEmail({
    to: email,
    link: data.properties.action_link,
    code: data.properties.email_otp,
    team,
  });
  return sent ? { status: "sent" } : { status: "fallback" };
}
