"use server";

import { type ActionResult, fail, field, ok } from "@/lib/action-result";
import { sendEmail, siteUrl } from "@/lib/email";
import { detailRows, esc } from "@/lib/email-template";
import { createAdminClient } from "@/lib/supabase/admin";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Someone asks to host an event. It goes to the team's inbox; nothing is stored. */
export async function hostEnquiry(_prev: ActionResult, data: FormData): Promise<ActionResult> {
  // A hidden field people don't see; bots tend to fill it in.
  if (field(data, "ms_trap_x")) return ok("Thank you. We’ll be in touch soon.");
  const name = field(data, "name");
  const email = field(data, "email");
  if (!name) return fail("Add your name.");
  if (!email || !EMAIL.test(email)) return fail("Add an email we can reply to.");

  const rows: [string, string][] = [
    ["Type", esc(field(data, "type") ?? "")],
    ["Guests", esc(field(data, "guests") ?? "Not said")],
    ["Dates", esc(field(data, "dates") ?? "Not said")],
    ["Spaces", esc(field(data, "spaces") ?? "")],
  ];
  const details = field(data, "details");

  const admin = createAdminClient();
  const { data: org } = admin ? await admin.from("org_settings").select("email").maybeSingle() : { data: null };
  if (!org?.email) return fail("We couldn’t send that just now. Email us directly and we’ll take it from there.");

  await sendEmail({
    to: org.email,
    subject: `Event enquiry: ${name}`,
    parts: {
      eyebrow: "Host an event",
      heading: name,
      body: `<p style="margin:0 0 14px">${esc(name)} (${esc(email)}) would like to host an event.</p>
${detailRows(rows)}
${details ? `<p style="margin:14px 0 0">“${esc(details)}”</p>` : ""}`,
      cta: { label: "Reply", href: `mailto:${email}` },
    },
    text: `${name} (${email}) would like to host an event.\n${rows.map(([k, v]) => `${k}: ${v}`).join("\n")}\n${details ?? ""}\n${await siteUrl()}`,
  });
  return ok("Thank you. We’ll be in touch soon.");
}
