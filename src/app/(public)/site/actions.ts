"use server";

import { type ActionResult, fail, field, ok } from "@/lib/action-result";
import { sendEmail, siteUrl } from "@/lib/email";
import { detailRows, esc } from "@/lib/email-template";
import { createAdminClient } from "@/lib/supabase/admin";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const THANKS = "Thank you. We’ll be in touch soon.";

type Enquiry = {
  /** Small label above the heading in the email, and the start of the subject. */
  kind: string;
  name: string;
  email: string;
  rows: [string, string | null][];
  /** Longer answers, shown as quotes under the table. */
  notes?: [string, string | null][];
};

/** Send an enquiry to the team's inbox. Nothing is stored, and nothing goes to any outside system. */
async function sendToTeam(e: Enquiry): Promise<ActionResult> {
  const admin = createAdminClient();
  const { data: org } = admin ? await admin.from("org_settings").select("email").maybeSingle() : { data: null };
  if (!org?.email) return fail("We couldn’t send that just now. Email us directly and we’ll take it from there.");
  const rows = e.rows.filter(([, v]) => v);
  const notes = (e.notes ?? []).filter(([, v]) => v) as [string, string][];
  await sendEmail({
    to: org.email,
    subject: `${e.kind}: ${e.name}`,
    parts: {
      eyebrow: e.kind,
      heading: e.name,
      body: `<p style="margin:0 0 14px">${esc(e.name)} (${esc(e.email)}) sent this from the website.</p>
${rows.length ? detailRows(rows.map(([k, v]) => [k, esc(v!)])) : ""}
${notes.map(([k, v]) => `<p style="margin:14px 0 0"><b>${esc(k)}</b><br>${esc(v)}</p>`).join("\n")}`,
      cta: { label: "Reply", href: `mailto:${e.email}` },
    },
    text: `${e.kind}: ${e.name} (${e.email})\n${rows.map(([k, v]) => `${k}: ${v}`).join("\n")}\n${notes.map(([k, v]) => `${k}: ${v}`).join("\n")}\n${await siteUrl()}`,
  });
  return ok(THANKS);
}

/** Name and email are on every form. Returns an error result, or the two values. */
function who(data: FormData): ActionResult | { name: string; email: string } {
  const name = field(data, "name");
  const email = field(data, "email");
  if (!name) return fail("Add your name.");
  if (!email || !EMAIL.test(email)) return fail("Add an email we can reply to.");
  return { name, email };
}

const isResult = (v: ActionResult | { name: string; email: string }): v is ActionResult => "ok" in v;

/** A journalist or producer asks to talk. */
export async function pressInquiry(_prev: ActionResult, data: FormData): Promise<ActionResult> {
  // A hidden field people don't see; bots tend to fill it in.
  if (field(data, "ms_trap_x")) return ok(THANKS);
  const w = who(data);
  if (isResult(w)) return w;
  return sendToTeam({
    kind: "Press inquiry",
    ...w,
    rows: [
      ["Company / publication", field(data, "company")],
      ["WhatsApp", field(data, "phone")],
    ],
    notes: [["Their audience", field(data, "audience")]],
  });
}

/** Someone offers to host, teach or create something at The ARK. */
export async function contribution(_prev: ActionResult, data: FormData): Promise<ActionResult> {
  if (field(data, "ms_trap_x")) return ok(THANKS);
  const w = who(data);
  if (isResult(w)) return w;
  const how = field(data, "how");
  if (!how) return fail("Choose how you’d like to contribute.");
  const more = field(data, "more");
  const why = field(data, "why");
  if (!more) return fail("Tell us a little more.");
  if (!why) return fail("Tell us what draws you to The ARK.");
  return sendToTeam({
    kind: "Contribute",
    ...w,
    rows: [
      ["WhatsApp", field(data, "phone")],
      ["Contribution", how],
      ["Instagram", field(data, "instagram")],
      ["TikTok", field(data, "tiktok")],
      ["YouTube", field(data, "youtube")],
      ["Website", field(data, "website")],
      ["Other links", field(data, "other")],
    ],
    notes: [
      ["More about it", more],
      ["What draws them", why],
    ],
  });
}

/** Someone asks for the stewardship brochure. The page shows the link once this succeeds. */
export async function brochureRequest(_prev: ActionResult, data: FormData): Promise<ActionResult> {
  if (field(data, "ms_trap_x")) return ok("Thank you.");
  const name = field(data, "name");
  const email = field(data, "email");
  if (!name) return fail("Add your first name.");
  if (!email || !EMAIL.test(email)) return fail("Add an email we can reply to.");
  const sent = await sendToTeam({ kind: "Brochure download", name, email, rows: [] });
  return sent.ok ? ok("Thank you. Your brochure is ready below.") : sent;
}

/** The stewardship application. The first two steps are the only ones known so far. */
export async function stewardshipApplication(_prev: ActionResult, data: FormData): Promise<ActionResult> {
  if (field(data, "ms_trap_x")) return ok("Thank you. We’ll be in touch soon.");
  const w = who(data);
  if (isResult(w)) return w;
  if (!field(data, "phone")) return fail("Add a WhatsApp number.");
  const joining = field(data, "joining");
  return sendToTeam({
    kind: "Stewardship application",
    ...w,
    rows: [
      ["WhatsApp", field(data, "phone")],
      ["Date of birth", field(data, "dob")],
      ["Nationality", field(data, "nationality")],
      ["Lives in", [field(data, "city"), field(data, "state"), field(data, "country"), field(data, "zip")].filter(Boolean).join(", ") || null],
      ["Joining", joining],
    ],
    notes: [
      ["What they do, and could it be done from Costa Rica", field(data, "work")],
      ["Background and story", field(data, "story")],
    ],
  });
}
