import "server-only";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { Resend } from "resend";
import { fmtDate, timeRange } from "@/lib/dates";

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

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * Email someone their ticket with the QR code inline. Returns false (and
 * sends nothing) when email isn't configured, so booking still works.
 */
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
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;

  const origin = await siteUrl();
  const url = ticketUrl(origin, t.token);
  const png = await QRCode.toBuffer(url, { width: 360, margin: 1 });
  const when = `${fmtDate(t.sessionDate, { weekday: "long", month: "long", day: "numeric" })}, ${timeRange({ start_time: t.startTime, end_time: t.endTime })}`;
  const first = t.holder.trim().split(/\s+/)[0] ?? "";

  const html = `<!doctype html><html><body style="margin:0;background:#F1F3EF;font-family:Helvetica,Arial,sans-serif;color:#1C2620">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 12px">
  <table role="presentation" width="100%" style="max-width:460px;background:#fff;border-radius:16px;overflow:hidden" cellpadding="0" cellspacing="0">
    <tr><td style="background:#21402D;color:#E7EEE6;padding:22px 26px;font-size:20px;font-weight:bold">${esc(t.orgName)}</td></tr>
    <tr><td style="padding:24px 26px 8px">
      <p style="margin:0 0 14px">Hi ${esc(first)},</p>
      <p style="margin:0 0 6px">Here is your ticket. Show the code at the gate when you arrive.</p>
      <h1 style="font-size:24px;margin:18px 0 4px">${esc(t.title)}</h1>
      <p style="margin:0;color:#5B6960">${esc(when)}${t.location ? ` at ${esc(t.location)}` : ""}</p>
    </td></tr>
    <tr><td align="center" style="padding:16px 26px 6px"><img src="cid:ticket-qr" width="220" height="220" alt="Ticket QR code" style="display:block"></td></tr>
    <tr><td align="center" style="padding:0 26px 6px;font-family:Menlo,monospace;font-size:16px;letter-spacing:2px">${ticketCode(t.token)}</td></tr>
    <tr><td align="center" style="padding:10px 26px 26px"><a href="${url}" style="color:#1F6E7A">Open your ticket</a></td></tr>
  </table>
  <p style="color:#5B6960;font-size:12px;margin:16px 0 0">See you there.</p>
  </td></tr></table></body></html>`;

  const resend = new Resend(key);
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM ?? "The ARK <onboarding@resend.dev>",
    to: t.to,
    subject: `Your ticket: ${t.title}`,
    html,
    text: `Hi ${first},\n\nHere is your ticket for ${t.title}, ${when}${t.location ? ` at ${t.location}` : ""}.\n\nOpen it here: ${url}\nCode: ${ticketCode(t.token)}\n\nSee you there.`,
    attachments: [
      { filename: "ticket-qr.png", content: png, contentId: "ticket-qr" },
    ],
  });
  if (error) {
    console.error("Ticket email failed", error);
    return false;
  }
  return true;
}
