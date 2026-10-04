"use server";

import { emailConfigured, sendSignInEmail, siteUrl } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/admin";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TEAM_DOMAIN = "theark.world";

export type SignInResult =
  | { status: "sent" }
  | { status: "fallback" }
  | { status: "error"; error: string };

/**
 * Send a sign-in link in the ARK email template. Needs Resend and the
 * Supabase service-role key; without them the form falls back to Supabase's
 * own email. The before-user-created hook still guards account creation.
 */
export async function sendSignInLink(rawEmail: string, next: string, team: boolean): Promise<SignInResult> {
  const admin = createAdminClient();
  if (!admin || !emailConfigured()) return { status: "fallback" };

  const email = rawEmail.trim().toLowerCase();
  if (!EMAIL.test(email)) return { status: "error", error: "Enter a valid email." };
  const isTeamEmail = email.endsWith(`@${TEAM_DOMAIN}`);
  if (team !== isTeamEmail) {
    return {
      status: "error",
      error: team ? `Use your @${TEAM_DOMAIN} email.` : "Team members sign in on the team page.",
    };
  }

  // The same rules as the sign-in hook, checked first so nobody gets an
  // email that can't work.
  const allowed = team
    ? await admin.from("team_members").select("id").eq("email", email).eq("status", "active").maybeSingle()
    : await admin
        .from("contacts")
        .select("id")
        .eq("email", email)
        .not("tier", "is", null)
        .eq("membership_status", "active")
        .limit(1)
        .maybeSingle();
  if (!allowed.data) {
    return {
      status: "error",
      error: team
        ? "You haven’t been added to ARK OS yet. Ask an admin to add you in Settings, Team."
        : "This email isn’t on an active membership. Write to us and we’ll sort it out.",
    };
  }

  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : team ? "/" : "/portal";
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
