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
  textToPlain,
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
      preheader: `${day}, ${time}. Show the QR code to security.`,
      eyebrow: "Your ticket",
      heading: t.title,
      body: `<p style="margin:0 0 16px">Hi ${esc(first)}, you’re booked in. Show this code to security when you arrive.</p>
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
      footnote: "Security lets you in from an hour before the start time.",
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
      preheader: textToPlain(m.body).slice(0, 120),
      body: textToHtml(m.body),
      footnote: "You’re receiving this because you’re in touch with The ARK. Reply any time.",
    },
    text: textToPlain(m.body),
  });
}

/** A guest's day pass, from the member who invited them. */
export async function sendGuestPassEmail(g: {
  to: string;
  guest: string;
  host: string;
  date: string;
  token: string;
  orgName: string;
}) {
  if (!emailConfigured()) return false;
  const origin = await siteUrl();
  const url = `${origin}/g/${g.token}`;
  const png = await QRCode.toBuffer(url, { width: 360, margin: 1 });
  const day = fmtDate(g.date, { weekday: "long", month: "long", day: "numeric" });
  const first = g.guest.trim().split(/\s+/)[0] ?? "";
  return sendEmail({
    to: g.to,
    subject: `${g.host} invited you to ${g.orgName}`,
    parts: {
      orgName: g.orgName,
      preheader: `Your guest pass for ${day}.`,
      eyebrow: "Guest pass",
      heading: `You’re invited, ${first}`,
      body: `<p style="margin:0 0 16px">${esc(g.host)} has invited you to spend the day at ${esc(g.orgName)}. Show this code to security when you arrive.</p>
${detailRows([
  ["When", esc(day)],
  ["Guest of", esc(g.host)],
])}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:4px 0 6px">
<img src="cid:guest-qr" width="200" height="200" alt="Guest pass QR code" style="display:block;border:0">
</td></tr></table>`,
      cta: { label: "Open your pass", href: url },
      footnote: "The pass works once, on the day of your visit.",
    },
    text: `Hi ${first},\n\n${g.host} has invited you to ${g.orgName} on ${day}. Show your pass to security when you arrive: ${url}\n\nThe pass works once, on the day of your visit.`,
    attachments: [{ filename: "guest-pass.png", content: png, contentId: "guest-qr" }],
  });
}

/**
 * After a day or week pass is paid on Stripe: the pass, with its QR code.
 * The pass has no dates yet; it starts at the first check-in at the gate.
 */
export async function sendPassEmail(m: {
  to: string;
  name: string;
  what: string;
  /** 1 for a day pass, 7 for a week pass. */
  days: number;
  /** "Sunday, January 4", the last day the first visit can happen. */
  useBy: string;
  url: string;
  orgName: string;
  /** A free pass given with a membership application, not a paid one. */
  free?: boolean;
}) {
  if (!emailConfigured()) return false;
  const png = await QRCode.toBuffer(m.url, { width: 360, margin: 1 });
  const first = m.name.trim().split(/\s+/)[0] ?? "";
  const covers = m.days === 1 ? "one day, 8am to 8pm" : `${m.days} days in a row, 8am to 8pm`;
  return sendEmail({
    to: m.to,
    subject: `Your ${m.what.toLowerCase()} for ${m.orgName}`,
    parts: {
      orgName: m.orgName,
      preheader: `Your pass is ready. It starts on your first visit; use it by ${m.useBy}.`,
      eyebrow: m.what,
      heading: `See you soon, ${esc(first)}`,
      body: `<p style="margin:0 0 16px">${m.free ? "Thank you for applying. A day with us is on us." : "Thank you, your payment went through."} Show this code to security when you arrive. Your pass starts the moment they check you in, and covers ${esc(covers)}.</p>
${detailRows([
  ["Pass", esc(m.what)],
  ["Covers", esc(covers)],
  ["Use by", esc(m.useBy)],
])}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:4px 0 6px">
<img src="cid:pass-qr" width="200" height="200" alt="Pass QR code" style="display:block;border:0">
</td></tr></table>`,
      cta: { label: "Open your pass", href: m.url },
      footnote: m.free ? "We’ll be in touch about your application." : "Your receipt comes separately from Stripe.",
    },
    text: `Hi ${first},\n\n${m.free ? "Thank you for applying. A day with us is on us." : "Thank you, your payment went through."} Your ${m.what.toLowerCase()} covers ${covers}, starting the moment security checks you in. Use it by ${m.useBy}.\n\nShow your pass when you arrive: ${m.url}\n\n${m.free ? "We’ll be in touch about your application." : "Your receipt comes separately from Stripe."}`,
    attachments: [{ filename: "pass.png", content: png, contentId: "pass-qr" }],
  });
}

/** The sign-in email in the ARK look: a button, and a code for another device. */
export async function sendSignInEmail(m: { to: string; link: string; code: string; team: boolean }) {
  return sendEmail({
    to: m.to,
    subject: `Your sign-in code: ${m.code}`,
    parts: {
      preheader: `Your code is ${m.code}. It works once and expires in an hour.`,
      eyebrow: m.team ? "Team sign-in" : "Members portal",
      heading: "Sign in to The ARK",
      body: `<p style="margin:0 0 18px">Tap the button to sign in. You can open it on your phone or your computer.</p>`,
      cta: { label: "Sign in", href: m.link },
      footnote: `Or enter this code on the sign-in page: <b style="font-family:Menlo,Consolas,monospace;font-size:15px;letter-spacing:3px;color:${BRAND.ink}">${esc(m.code)}</b><br>It works once and expires in an hour. If you didn’t ask for it, you can ignore this email.`,
    },
    text: `Sign in to The ARK: ${m.link}\n\nOr enter this code on the sign-in page: ${m.code}\n\nIt works once and expires in an hour. If you didn't ask for it, you can ignore this email.`,
  });
}

/** The welcome after a membership of a month or longer starts: a sign-in
 * link that lands on the portal's quick set-up. */
export async function sendPortalWelcomeEmail(m: {
  to: string;
  name: string;
  /** A magic link when the service role key is set, else the sign-in page. */
  link: string;
  signsIn: boolean;
  orgName: string;
}) {
  const origin = await siteUrl();
  const first = m.name.trim().split(/\s+/)[0] ?? "";
  const login = `${origin}/portal/login`;
  return sendEmail({
    to: m.to,
    subject: `Welcome to ${m.orgName}. Your members portal is ready`,
    parts: {
      orgName: m.orgName,
      preheader: "Your membership is active. Two minutes to set up your profile.",
      eyebrow: "Members portal",
      heading: `Welcome, ${esc(first)}`,
      body: `<p style="margin:0 0 16px">Your membership is active. The members portal is where you book classes and court time, see who else is going, and meet the other members.</p>
<p style="margin:0 0 18px">Start by setting up your profile: a photo, a few lines about you, and the cities you spend time in. It takes two minutes.</p>`,
      cta: { label: "Set up your profile", href: m.link },
      footnote: m.signsIn
        ? `The button signs you in on its own. If it has stopped working, sign in at <a href="${login}" style="color:${BRAND.sea}">${esc(login.replace(/^https?:\/\//, ""))}</a> with this email and we’ll send you a fresh link.`
        : `Sign in with this email address, no password needed. We’ll send you a link each time.`,
    },
    text: `Hi ${first},\n\nYour membership at ${m.orgName} is active. The members portal is where you book classes and court time, see who else is going, and meet the other members.\n\nSet up your profile here: ${m.link}\n\n${m.signsIn ? `If the link has stopped working, sign in at ${login} with this email and we'll send you a fresh one.` : "Sign in with this email address, no password needed."}`,
  });
}

/**
 * A court booking confirmation (or a joined open match), keyed by a booking
 * or player token. Reads what the booking page shows and sends it to the
 * person on that row. Returns false when email isn't configured or there is
 * nobody to send to.
 */
export async function sendCourtEmail(
  sb: { rpc: (fn: "court_booking_by_token", args: { p_token: string }) => PromiseLike<{ data: unknown }> },
  token: string,
) {
  if (!emailConfigured()) return false;
  const { data } = await sb.rpc("court_booking_by_token", { p_token: token });
  const d = data as {
    booking: {
      court: string;
      date: string;
      start_time: string;
      end_time: string;
      open_match: boolean;
      spots: number | null;
      currency: string;
    };
    you: { token: string; host: boolean; name: string; email: string | null; amount: number; paid: boolean } | null;
  } | null;
  if (!d?.you?.email) return false;
  const origin = await siteUrl();
  const url = `${origin}/courts/b/${d.you.token}`;
  const day = fmtDate(d.booking.date, { weekday: "long", month: "long", day: "numeric" });
  const time = timeRange({ start_time: d.booking.start_time, end_time: d.booking.end_time });
  const first = d.you.name.trim().split(/\s+/)[0] ?? "";
  const amount =
    d.booking.currency === "USD"
      ? `$${Number(d.you.amount).toLocaleString("en-US", { maximumFractionDigits: 2 })}`
      : `₡${Math.round(Number(d.you.amount)).toLocaleString("en-US")}`;
  const what = d.booking.open_match ? (d.you.host ? "Your open match" : "You’re in the match") : "Your court";
  const paidLine = d.you.paid
    ? `${amount} paid.`
    : Number(d.you.amount) > 0
      ? `${amount} to settle at reception.`
      : "";
  const gcal = googleCalendarUrl({
    title: `${d.booking.court} · The ARK`,
    date: d.booking.date,
    start: d.booking.start_time,
    end: d.booking.end_time,
    location: "The ARK, Santa Teresa",
    details: `Your booking: ${url}`,
  });
  const link = `color:${BRAND.sea}`;
  return sendEmail({
    to: d.you.email,
    subject: `${what}: ${d.booking.court}, ${fmtDate(d.booking.date)}`,
    parts: {
      orgName: "The ARK",
      preheader: `${day}, ${time}.`,
      eyebrow: "Courts",
      heading: d.booking.court,
      body: `<p style="margin:0 0 16px">Hi ${esc(first)}, you’re booked. ${esc(paidLine)}</p>
${detailRows([
  ["When", `${esc(day)}<br>${esc(time)}`],
  ["Where", "The ARK, Santa Teresa"],
  ...(d.booking.open_match
    ? ([["Match", `Open match, ${d.booking.spots ?? 4} players. Share the page below to fill it.`]] as [string, string][])
    : []),
])}
<p style="margin:16px 0 18px;font-size:14px;text-align:center">Add to <a href="${gcal}" style="${link}">Google Calendar</a> · <a href="${url}/calendar.ics" style="${link}">Apple or Outlook</a></p>`,
      cta: { label: "Open your booking", href: url },
      footnote: "Cancel from the booking page up to 24 hours before. Rackets and balls are at reception.",
    },
    text: `Hi ${first},\n\n${what}: ${d.booking.court}, ${day}, ${time}. ${paidLine}\n\nYour booking: ${url}\n\nSee you on court.`,
  });
}
