import "server-only";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { Resend } from "resend";
import { googleCalendarUrl } from "@/lib/calendar";
import { fmtDate, timeRange } from "@/lib/dates";
import {
  arkEmail,
  BRAND,
  detailRows,
  type EmailParts,
  esc,
  textToHtml,
} from "@/lib/email-template";

/** Absolute URL of this deployment, for links in emails and QR codes. */
export async function siteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export const ticketUrl = (origin: string, token: string) => `${origin}/t/${token}`;

/** The 6-character code printed under the QR, for reading out at the gate. */
export const ticketCode = (token: string) => `ARK-${token.slice(-6).toUpperCase()}`;

type Attachment = { filename: string; content: Buffer; contentId?: string };

/**
 * Send one email in the ARK template. Returns false (and sends nothing) when
 * email isn't configured, so the action that called it still succeeds.
 */
export async function sendEmail(m: {
  to: string;
  subject: string;
  parts: Omit<EmailParts, "origin">;
  text: string;
  attachments?: Attachment[];
}) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const origin = await siteUrl();
  const { error } = await new Resend(key).emails.send({
    from: process.env.RESEND_FROM ?? "The ARK <onboarding@resend.dev>",
    to: m.to,
    subject: m.subject,
    html: arkEmail({ origin, ...m.parts }),
    text: m.text,
    attachments: m.attachments,
  });
  if (error) {
    console.error("Email failed", m.subject, error);
    return false;
  }
  return true;
}

export const emailConfigured = () => !!process.env.RESEND_API_KEY;

/** Email someone their ticket with the QR code inline. */
export async function sendTicketEmail(t: {
  to: string;
  holder: string;
  title: string;
  sessionDate: string;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  token: string;
  orgName: string;
}) {
  if (!emailConfigured()) return false;
  const origin = await siteUrl();
  const url = ticketUrl(origin, t.token);
  const png = await QRCode.toBuffer(url, { width: 360, margin: 1 });
  const day = fmtDate(t.sessionDate, { weekday: "long", month: "long", day: "numeric" });
  const time = timeRange({ start_time: t.startTime, end_time: t.endTime });
  const first = t.holder.trim().split(/\s+/)[0] ?? "";
  const gcal = googleCalendarUrl({
    title: `${t.title} · ${t.orgName}`,
    date: t.sessionDate,
    start: t.startTime,
    end: t.endTime,
    location: t.location,
    details: `Your ticket: ${url}`,
  });
  const link = `color:${BRAND.sea}`;

  return sendEmail({
    to: t.to,
    subject: `Your ticket: ${t.title}`,
    parts: {
      orgName: t.orgName,
      preheader: `${day}, ${time}. Show the QR code at the gate.`,
      eyebrow: "Your ticket",
      heading: t.title,
      body: `<p style="margin:0 0 16px">Hi ${esc(first)}, you’re booked in. Show this code at the gate when you arrive.</p>
${detailRows([
  ["When", `${esc(day)}<br>${esc(time)}`],
  ...(t.location ? ([["Where", esc(t.location)]] as [string, string][]) : []),
  ["Name", esc(t.holder)],
])}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:4px 0 6px">
<img src="cid:ticket-qr" width="200" height="200" alt="Ticket QR code" style="display:block;border:0">
<p style="margin:10px 0 0;font-family:Menlo,Consolas,monospace;font-size:16px;letter-spacing:3px">${ticketCode(t.token)}</p>
</td></tr></table>
<p style="margin:16px 0 18px;font-size:14px;text-align:center">Add to <a href="${gcal}" style="${link}">Google Calendar</a> · <a href="${url}/calendar.ics" style="${link}">Apple or Outlook</a></p>`,
      cta: { label: "Open your ticket", href: url },
      footnote: "The gate opens an hour before the start time.",
    },
    text: `Hi ${first},\n\nHere is your ticket for ${t.title}, ${day}, ${time}${t.location ? ` at ${t.location}` : ""}.\n\nOpen it here: ${url}\nCode: ${ticketCode(t.token)}\n\nSee you there.`,
    attachments: [{ filename: "ticket-qr.png", content: png, contentId: "ticket-qr" }],
  });
}

/** A workflow email step, merged for one person, in the ARK template. */
export async function sendWorkflowEmail(m: {
  to: string;
  subject: string;
  body: string;
  orgName: string;
}) {
  return sendEmail({
    to: m.to,
    subject: m.subject || m.orgName,
    parts: {
      orgName: m.orgName,
      preheader: m.body.slice(0, 120),
      body: textToHtml(m.body),
      footnote: "You’re receiving this because you’re in touch with The ARK. Reply any time.",
    },
    text: m.body,
  });
}
