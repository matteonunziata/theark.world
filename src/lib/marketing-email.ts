import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import type { Database } from "@/lib/database.types";
import { arkEmail, BRAND, textToHtml, textToPlain } from "@/lib/email-template";
import { mergeFields, slug, tagLinks } from "@/lib/marketing";

// Marketing email through Resend: campaigns to a list, test sends, and the
// waitlist automation. Every email carries a one-click unsubscribe link
// (/u/{send id}) and UTM tags on its links. Opens, clicks and bounces come
// back through /api/webhooks/resend.

type Sb = SupabaseClient<Database>;

export const marketingEmailReady = () => !!process.env.RESEND_API_KEY;
const from = () => process.env.MARKETING_FROM ?? process.env.RESEND_FROM ?? "The ARK <onboarding@resend.dev>";

type Recipient = { sendId: string; email: string; name: string | null };

function render(m: {
  origin: string;
  subject: string;
  body: string;
  recipient: Recipient;
  utmCampaign: string;
  brand?: string | null;
  applicationUrl?: string | null;
}) {
  const merged = mergeFields(m.body, { name: m.recipient.name, application_url: m.applicationUrl });
  const tagged = tagLinks(merged, {
    source: "email",
    medium: "email",
    campaign: m.utmCampaign,
    content: m.brand ?? undefined,
  });
  const unsub = `${m.origin}/u/${m.recipient.sendId}`;
  return {
    from: from(),
    to: m.recipient.email,
    subject: mergeFields(m.subject, { name: m.recipient.name }),
    html: arkEmail({
      origin: m.origin,
      preheader: textToPlain(tagged).slice(0, 120),
      body: textToHtml(tagged),
      footnote: `You’re receiving this because you’re in touch with The ARK. <a href="${unsub}" style="color:${BRAND.muted}">Unsubscribe</a>`,
    }),
    text: `${textToPlain(tagged)}\n\nUnsubscribe: ${unsub}`,
    headers: {
      "List-Unsubscribe": `<${m.origin}/api/unsubscribe/${m.recipient.sendId}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
}

/** Send in batches of 100 and record Resend's ids against our send rows. */
async function deliver(sb: Sb, emails: { sendId: string; email: ReturnType<typeof render> }[]) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  let sent = 0;
  for (let i = 0; i < emails.length; i += 100) {
    const chunk = emails.slice(i, i + 100);
    const { data, error } = await resend.batch.send(chunk.map((c) => c.email));
    const now = new Date().toISOString();
    if (error || !data) {
      console.error("Marketing batch failed", error);
      await sb.from("email_sends").update({ status: "failed" }).in("id", chunk.map((c) => c.sendId));
      continue;
    }
    await Promise.all(
      chunk.map((c, j) =>
        sb
          .from("email_sends")
          .update({ status: "sent", sent_at: now, resend_id: data.data[j]?.id ?? null })
          .eq("id", c.sendId),
      ),
    );
    sent += chunk.length;
  }
  return sent;
}

/** Send a campaign to its list now. Safe to call twice: each address gets it once. */
export async function sendCampaign(sb: Sb, campaignId: string, origin: string) {
  const { data: c } = await sb.from("email_campaigns").select("*").eq("id", campaignId).single();
  if (!c) throw new Error("Campaign not found.");
  if (c.status === "sent") return 0;
  const { data: sample } = await sb.rpc("is_sample", { p_table: "email_campaigns", p_id: c.id });
  if (sample) throw new Error("This is a sample campaign, so it doesn’t send. Create a new campaign to send for real.");
  if (!c.subject.trim() || !c.body.trim()) throw new Error("Add a subject and a message first.");
  const { data: people, error } = await sb.rpc("marketing_list", { p_list: c.list_key });
  if (error) throw error;
  await sb.from("email_campaigns").update({ status: "sending" }).eq("id", c.id);

  // Reserve a send row per address; addresses that already have one are skipped.
  const { data: rows, error: insErr } = await sb
    .from("email_sends")
    .upsert(
      (people ?? []).map((p) => ({ campaign_id: c.id, contact_id: p.contact_id, email: p.email })),
      { onConflict: "campaign_id,email", ignoreDuplicates: true },
    )
    .select("id, email, contact_id");
  if (insErr) throw insErr;
  const names = new Map((people ?? []).map((p) => [p.email.toLowerCase(), p.name]));
  const sent = await deliver(
    sb,
    (rows ?? []).map((r) => ({
      sendId: r.id,
      email: render({
        origin,
        subject: c.subject,
        body: c.body,
        recipient: { sendId: r.id, email: r.email, name: names.get(r.email.toLowerCase()) ?? null },
        utmCampaign: slug(c.name),
        brand: c.brands[0],
      }),
    })),
  );
  await sb
    .from("email_campaigns")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", c.id);
  return sent;
}

/** One copy to a staff member, marked as a test so it isn't counted. */
export async function sendTest(
  sb: Sb,
  m: { to: string; name: string; subject: string; body: string; utmCampaign: string; applicationUrl?: string | null },
  origin: string,
) {
  const { data: row, error } = await sb
    .from("email_sends")
    .insert({ email: m.to, status: "test" })
    .select("id")
    .single();
  if (error) throw error;
  const e = render({
    origin,
    subject: `[Test] ${m.subject}`,
    body: m.body,
    recipient: { sendId: row.id, email: m.to, name: m.name },
    utmCampaign: m.utmCampaign,
    applicationUrl: m.applicationUrl,
  });
  const { error: sendErr } = await new Resend(process.env.RESEND_API_KEY).emails.send(e);
  if (sendErr) throw new Error("Resend didn’t accept the test. Check the sending domain.");
}

/**
 * The waitlist automation: a welcome to everyone who joined the waitlist
 * in the last two days and hasn't had one, then the application link once
 * the follow-up delay has passed. Only signups count (not people moved onto
 * the waitlist by hand), so switching it on doesn't email the whole list.
 */
export async function runAutomation(sb: Sb, origin: string, onlyContact?: string) {
  const { data: a } = await sb.from("email_automations").select("*").eq("key", "waitlist").single();
  if (!a?.active) return 0;
  let total = 0;

  let q = sb
    .from("contacts")
    .select("id, name, email, waitlist_at, email_opt_out, email_sends(automation_step, sent_at, status)")
    .not("waitlist_at", "is", null)
    .not("email", "is", null)
    .eq("email_opt_out", false)
    .gte("waitlist_at", new Date(Date.now() - 2 * 86400000).toISOString());
  if (onlyContact) q = q.eq("id", onlyContact);
  const { data: fresh } = await q;
  const needWelcome = (fresh ?? []).filter((c) => !c.email_sends.some((s) => s.automation_step === "welcome" && s.status !== "test"));

  const cutoff = new Date(Date.now() - a.followup_days * 86400000).toISOString();
  const { data: welcomed } = onlyContact
    ? { data: [] }
    : await sb
        .from("email_sends")
        .select("contact_id, contacts(id, name, email, email_opt_out, email_sends(automation_step, status))")
        .eq("automation_step", "welcome")
        .eq("status", "sent")
        .lte("sent_at", cutoff);
  const needFollow = (welcomed ?? [])
    .map((w) => w.contacts)
    .filter((c): c is NonNullable<typeof c> => !!c && !!c.email && !c.email_opt_out)
    .filter((c) => !c.email_sends.some((s) => s.automation_step === "followup" && s.status !== "test"));

  for (const [step, people, subject, body] of [
    ["welcome", needWelcome, a.welcome_subject, a.welcome_body],
    ["followup", needFollow, a.followup_subject, a.followup_body],
  ] as const) {
    if (!people.length || !subject.trim()) continue;
    const { data: rows } = await sb
      .from("email_sends")
      .upsert(
        people.map((p) => ({ automation_step: step, contact_id: p.id, email: p.email! })),
        { onConflict: "automation_step,contact_id", ignoreDuplicates: true },
      )
      .select("id, email, contact_id");
    const byId = new Map(people.map((p) => [p.id, p.name]));
    total += await deliver(
      sb,
      (rows ?? []).map((r) => ({
        sendId: r.id,
        email: render({
          origin,
          subject,
          body,
          recipient: { sendId: r.id, email: r.email, name: byId.get(r.contact_id ?? "") ?? null },
          utmCampaign: `waitlist-${step}`,
          brand: "membership",
          applicationUrl: a.application_url,
        }),
      })),
    );
  }
  return total;
}

/** Everything that's due: scheduled campaigns and the automation. */
export async function runDue(sb: Sb, origin: string) {
  if (!marketingEmailReady()) return { campaigns: 0, automation: 0 };
  const { data: due } = await sb
    .from("email_campaigns")
    .select("id")
    .eq("status", "scheduled")
    .lte("scheduled_at", new Date().toISOString());
  let campaigns = 0;
  for (const c of due ?? []) {
    try {
      await sendCampaign(sb, c.id, origin);
      campaigns++;
    } catch (e) {
      console.error("Scheduled campaign failed", c.id, e);
    }
  }
  return { campaigns, automation: await runAutomation(sb, origin) };
}
