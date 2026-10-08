"use server";

import { redirect } from "next/navigation";
import { type ActionResult, fail, field, friendly, ok } from "@/lib/action-result";
import { getViewer } from "@/lib/auth";
import { fmtDate } from "@/lib/dates";
import { sendPassEmail, siteUrl } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyLater } from "@/lib/slack";
import { sendGuestPassWhatsApp } from "@/lib/whatsapp";
import { applicationMessage } from "@/lib/slack-format";

const list = (data: FormData, name: string) =>
  data
    .getAll(name)
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean)
    .slice(0, 10);

type Invitee = { name: string; contact: string };

/** Up to three invited people; a name alone still counts. */
const inviteList = (data: FormData): Invitee[] => {
  const names = data.getAll("invite_name");
  const contacts = data.getAll("invite_contact");
  return names
    .map((n, i) => ({
      name: typeof n === "string" ? n.trim() : "",
      contact: typeof contacts[i] === "string" ? (contacts[i] as string).trim() : "",
    }))
    .filter((p) => p.name || p.contact)
    .slice(0, 3);
};

const inviteNotes = (people: Invitee[]) =>
  people.map((p) => [p.name, p.contact].filter(Boolean).join(" · "));

/**
 * Email the free day pass that came with an application (see
 * public.apply_for_membership). Only for a pass made just now, so a double
 * submit doesn't send it twice.
 */
async function emailFreePass(applicationId: string | null): Promise<string | null> {
  const admin = createAdminClient();
  if (!admin || !applicationId) return null;
  const { data: a } = await admin
    .from("membership_applications")
    .select("free_pass_id, contact:contacts(name, email, pass_token)")
    .eq("id", applicationId)
    .maybeSingle();
  if (!a?.free_pass_id) return null;
  const { data: pass } = await admin
    .from("memberships")
    .select("activate_by, created_at")
    .eq("id", a.free_pass_id)
    .maybeSingle();
  if (!a.contact?.email || !pass?.activate_by) return null;
  if (Date.now() - new Date(pass.created_at).getTime() > 2 * 60_000) return a.contact.pass_token;
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
  return a.contact.pass_token;
}

/**
 * Give each invited person their own free day pass and send it: by email when
 * they gave an address, otherwise by WhatsApp. Anyone who has already had a free
 * pass (from an application or an invite) is skipped, so a double submit or a
 * repeat invite never sends a second one.
 */
async function sendInviteePasses(applicationId: string | null, invitees: Invitee[]) {
  const admin = createAdminClient();
  const people = invitees.filter((p) => p.name && p.contact);
  if (!admin || !applicationId || people.length === 0) return;
  const { data: app } = await admin
    .from("membership_applications")
    .select("contact:contacts(name, email)")
    .eq("id", applicationId)
    .maybeSingle();
  const host = app?.contact?.name ?? "A friend";
  const [origin, { data: org }, { data: today }] = await Promise.all([
    siteUrl(),
    admin.rpc("public_org").maybeSingle(),
    admin.rpc("org_today"),
  ]);
  const orgName = org?.name ?? "The ARK";
  const useBy = new Date(`${today}T00:00:00Z`);
  useBy.setUTCDate(useBy.getUTCDate() + 90);
  const activateBy = useBy.toISOString().slice(0, 10);
  const useByLabel = fmtDate(activateBy, { weekday: "long", month: "long", day: "numeric" });

  await Promise.all(
    people.map(async (p) => {
      const isEmail = p.contact.includes("@");
      const email = isEmail ? p.contact.toLowerCase() : null;
      if (email && email === app?.contact?.email?.toLowerCase()) return;

      const found = email
        ? await admin.from("contacts").select("id, pass_token").eq("email", email).maybeSingle()
        : await admin.from("contacts").select("id, pass_token").eq("phone", p.contact).limit(1).maybeSingle();
      let contact = found.data;
      if (!contact) {
        const made = await admin
          .from("contacts")
          .insert({
            name: p.name.slice(0, 200),
            email,
            phone: isEmail ? null : p.contact.slice(0, 60),
            source: "Membership invite",
          })
          .select("id, pass_token")
          .single();
        if (made.error) return console.error("Invitee contact failed", made.error);
        contact = made.data;
        await admin.from("contact_notes").insert({ contact_id: contact.id, body: `Invited by ${host} for a free day pass.` });
      }

      const { data: had } = await admin
        .from("memberships")
        .select("id")
        .eq("contact_id", contact.id)
        .in("source", ["application", "invite"])
        .limit(1);
      if (had?.length) return;
      const { error } = await admin.from("memberships").insert({
        contact_id: contact.id,
        tier: "day",
        status: "unused",
        activate_by: activateBy,
        source: "invite",
        notes: `Invited by ${host}`,
      });
      if (error) return console.error("Invitee pass failed", error);

      const url = `${origin}/p/${contact.pass_token}`;
      if (email) {
        await sendPassEmail({
          to: email,
          name: p.name,
          what: "Day Pass",
          days: 1,
          useBy: useByLabel,
          url,
          orgName,
          free: true,
          invitedBy: host,
        });
      } else {
        await sendGuestPassWhatsApp({ phone: p.contact, guest: p.name, host, day: `any day before ${useByLabel}`, url });
      }
    }),
  );
}

/** Send a membership application into the CRM (see public.apply_for_membership). */
export async function applyForMembership(_prev: ActionResult, data: FormData): Promise<ActionResult> {
  // A hidden field people don't see; bots tend to fill it in.
  if (field(data, "ms_trap_x")) return ok("Application received");
  const { supabase } = await getViewer();
  const invitees = inviteList(data);
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
    p_invites: inviteNotes(invitees),
    p_source: field(data, "utm_source")?.slice(0, 120) ?? "",
    p_medium: field(data, "utm_medium")?.slice(0, 120) ?? "",
    p_campaign: field(data, "utm_campaign")?.slice(0, 120) ?? "",
  });
  if (error) return fail(friendly(error));

  // Their free day pass, by email (never blocks the application).
  const passToken = await emailFreePass(contactId ?? null).catch((e) => {
    console.error("Free pass email failed", e);
    return null;
  });

  // Their invited friends get a free day pass each (never blocks the application).
  await sendInviteePasses(contactId ?? null, invitees).catch((e) => console.error("Invitee passes failed", e));

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
  // Straight to their pass.
  if (passToken) redirect(`/p/${passToken}`);
  return ok("Application received");
}
