"use server";

import { type ActionResult, fail, field, friendly, ok } from "@/lib/action-result";
import { getViewer } from "@/lib/auth";
import { fmtDate } from "@/lib/dates";
import { sendEmail, siteUrl } from "@/lib/email";
import { detailRows, esc } from "@/lib/email-template";
import { nights } from "@/lib/estate";
import { money } from "@/lib/schedule";
import { notifyLater } from "@/lib/slack";
import { stayMessage } from "@/lib/slack-format";
import { createAdminClient } from "@/lib/supabase/admin";

/** A guest asks to stay. It lands as an inquiry the team confirms. */
export async function requestStay(_prev: ActionResult, data: FormData): Promise<ActionResult> {
  const { supabase } = await getViewer();
  const lotId = field(data, "lot_id");
  const checkIn = field(data, "check_in");
  const checkOut = field(data, "check_out");
  const name = field(data, "name") ?? "";
  const email = field(data, "email") ?? "";
  if (!lotId || !checkIn || !checkOut) return fail("Choose your dates.");
  // A hidden field people don't see; bots tend to fill it in.
  if (field(data, "hp_contact")) return ok("Thanks. We’ll be in touch.");

  const guests = Math.max(1, Number(field(data, "guests") ?? 1) || 1);
  const { error } = await supabase.rpc("request_stay", {
    p_lot_id: lotId,
    p_check_in: checkIn,
    p_check_out: checkOut,
    p_guests: guests,
    p_name: name,
    p_email: email,
    p_phone: field(data, "phone"),
    p_message: field(data, "message"),
  });
  if (error) return fail(friendly(error));

  // Emails are a courtesy; the request is saved either way.
  const { data: home } = await supabase.rpc("public_listing", { p_id: lotId });
  const h = home as { title: string; nightly_rate: number | null; rate_currency: string; cleaning_fee: number | null } | null;
  const n = nights(checkIn, checkOut);
  const when = `${fmtDate(checkIn, { weekday: "short", month: "long", day: "numeric" })} to ${fmtDate(checkOut, { weekday: "short", month: "long", day: "numeric" })}`;
  const total =
    h?.nightly_rate !== null && h?.nightly_rate !== undefined
      ? money(Number(h.nightly_rate) * n + Number(h.cleaning_fee ?? 0), h.rate_currency)
      : null;
  const first = name.trim().split(/\s+/)[0] ?? "";
  const stay = {
    name,
    email,
    home: h?.title ?? "a home",
    checkIn,
    checkOut,
    nights: n,
    guests,
    estimate: total,
    note: field(data, "message"),
    lotId,
  };
  notifyLater("stay", (origin) => stayMessage(stay, origin));
  await sendEmail({
    to: email,
    subject: `Your request to stay at ${h?.title ?? "The ARK"}`,
    parts: {
      preheader: `${when}. We’ll confirm within a day.`,
      eyebrow: "Request received",
      heading: h?.title ?? "Your stay",
      body: `<p style="margin:0 0 16px">Hi ${esc(first)}, thank you for asking to stay with us. We’ll check the dates with the home’s steward and confirm within a day.</p>
${detailRows([
  ["Dates", `${esc(when)}<br>${n} night${n === 1 ? "" : "s"}`],
  ...(total ? ([["Estimate", esc(total)]] as [string, string][]) : []),
])}`,
      footnote: "Nothing is charged until we confirm. Reply to this email with any questions.",
    },
    text: `Hi ${first},\n\nThank you for asking to stay at ${h?.title ?? "The ARK"}, ${when}. We'll confirm within a day. Nothing is charged until then.`,
  });

  const admin = createAdminClient();
  const { data: org } = admin ? await admin.from("org_settings").select("email").maybeSingle() : { data: null };
  if (org?.email) {
    await sendEmail({
      to: org.email,
      subject: `Booking request: ${h?.title ?? "a home"}, ${when}`,
      parts: {
        eyebrow: "New booking request",
        heading: name,
        body: `<p style="margin:0 0 14px">${esc(name)} (${esc(email)}) asked to stay at ${esc(h?.title ?? "a home")}, ${esc(when)}.</p>
${field(data, "message") ? `<p style="margin:0 0 14px">“${esc(field(data, "message")!)}”</p>` : ""}`,
        cta: { label: "Open Hospitality", href: `${await siteUrl()}/hospitality/${lotId}` },
      },
      text: `${name} (${email}) asked to stay at ${h?.title}, ${when}.`,
    });
  }
  return ok("Request sent");
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** A guest asks about meals, experiences or travel. It goes to the team's inbox; nothing is stored. */
export async function stayEnquiry(_prev: ActionResult, data: FormData): Promise<ActionResult> {
  // A hidden field people don't see; bots tend to fill it in.
  if (field(data, "hp_contact")) return ok("Thank you. We’ll be in touch soon.");
  const name = field(data, "name");
  const email = field(data, "email");
  if (!name) return fail("Add your name.");
  if (!email || !EMAIL.test(email)) return fail("Add an email we can reply to.");

  const topic = field(data, "topic") ?? "Something else";
  const dates = field(data, "dates");
  const details = field(data, "details");

  const admin = createAdminClient();
  const { data: org } = admin ? await admin.from("org_settings").select("email").maybeSingle() : { data: null };
  if (!org?.email) return fail("We couldn’t send that just now. Email us directly and we’ll take it from there.");

  await sendEmail({
    to: org.email,
    subject: `Stay enquiry (${topic}): ${name}`,
    parts: {
      eyebrow: "Stay enquiry",
      heading: name,
      body: `<p style="margin:0 0 14px">${esc(name)} (${esc(email)}) asked about ${esc(topic.toLowerCase())}.</p>
${detailRows([
  ["Topic", esc(topic)],
  ["Dates", esc(dates ?? "Not said")],
])}
${details ? `<p style="margin:14px 0 0">“${esc(details)}”</p>` : ""}`,
      cta: { label: "Reply", href: `mailto:${email}` },
    },
    text: `${name} (${email}) asked about ${topic}.\nDates: ${dates ?? "Not said"}\n${details ?? ""}\n${await siteUrl()}`,
  });
  return ok("Thank you. We’ll be in touch soon.");
}
