import type { Metadata } from "next";
import Link from "next/link";
import QRCode from "qrcode";
import { AddToCalendar } from "@/components/add-to-calendar";
import { PortalHead } from "@/components/portal-head";
import { getViewer } from "@/lib/auth";
import { fmtDate, timeRange } from "@/lib/dates";
import { siteUrl, ticketCode, ticketUrl } from "@/lib/email";
import { kindName, money } from "@/lib/schedule";
import { CheckInButton, CopyTicketLink } from "./ticket-actions";

export const metadata: Metadata = { title: "Ticket", robots: { index: false } };

const STATE: Record<string, [string, string]> = {
  valid: ["ok", "Valid today"],
  upcoming: ["soon", "Valid on the day"],
  used: ["used", "Checked in"],
  expired: ["bad", "Expired"],
  cancelled: ["bad", "Session cancelled"],
};

export default async function TicketPage({ params }: PageProps<"/t/[token]">) {
  const { token } = await params;
  const { supabase, staff } = await getViewer();
  const [{ data: t }, { data: org }] = await Promise.all([
    supabase.rpc("ticket_by_token", { p_token: token }).maybeSingle(),
    supabase.rpc("public_org").maybeSingle(),
  ]);
  const orgName = org?.name ?? "The ARK";
  const head = (
    <PortalHead
      name={orgName}
      sub={staff ? "Gate check" : "Your ticket"}
      link={staff ? { href: "/gate", label: "Gate console" } : undefined}
    />
  );

  if (!t) {
    return (
      <>
        {head}
        <div className="p-body">
          <div className="ticket">
            <span className="state bad">Not valid</span>
            <h1>Ticket not found</h1>
            <p className="muted">This ticket may have been cancelled, or the link is incomplete.</p>
          </div>
        </div>
      </>
    );
  }

  const url = ticketUrl(await siteUrl(), token);
  const svg = await QRCode.toString(url, { type: "svg", margin: 0 });
  const [cls, label] = STATE[t.state] ?? ["bad", "Not valid"];

  return (
    <>
      {head}
      <div className="p-body">
        <div className="ticket">
          <span className="ptype">
            {orgName} · {kindName(t.kind)}
          </span>
          <h1>{t.title}</h1>
          <p style={{ margin: "4px 0 0" }}>
            {fmtDate(t.session_date, { weekday: "long", month: "long", day: "numeric" })},{" "}
            {timeRange(t)}
            {t.location ? ` at ${t.location}` : ""}
            {t.facilitator ? `, with ${t.facilitator}` : ""}
          </p>
          {/* QR markup generated on the server from our own URL. */}
          <div className="qr" dangerouslySetInnerHTML={{ __html: svg }} />
          <div className="code">{ticketCode(token)}</div>
          <p style={{ margin: "10px 0 0" }}>
            <b>{t.holder}</b>
            <br />
            <span className="muted">
              {t.ticket_name
                ? `${t.ticket_name}, ${money(t.price, t.currency)}${Number(t.price) > 0 ? (t.paid ? ", paid" : ", unpaid") : ""}`
                : "Member, included"}
            </span>
          </p>
          <span className={`state ${cls}`}>
            {t.state === "used" && t.checked_in_at
              ? `Checked in ${new Date(t.checked_in_at).toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                  timeZone: org?.timezone ?? "America/Costa_Rica",
                })}`
              : label}
          </span>
          <div className="acts">
            {t.can_check_in && t.state === "valid" && <CheckInButton token={token} />}
            <CopyTicketLink url={url} />
          </div>
          {(t.state === "valid" || t.state === "upcoming") && (
            <AddToCalendar
              icsHref={`/t/${token}/calendar.ics`}
              event={{
                title: `${t.title} · ${orgName}`,
                date: t.session_date,
                start: t.start_time,
                end: t.end_time,
                location: [t.location, org?.location].filter(Boolean).join(", "),
                details: `Your ticket: ${url}`,
                timeZone: org?.timezone,
              }}
            />
          )}
          <p className="gate-note" style={{ marginTop: 16 }}>
            Security scans the code with any phone camera. It opens this page
            and shows whether the ticket is valid.
          </p>
        </div>
        <p style={{ textAlign: "center", marginTop: 18 }}>
          <Link className="ev-back" style={{ display: "inline" }} href={`/e/${t.offering_id}`}>
            ← Back to {t.title}
          </Link>
        </p>
      </div>
    </>
  );
}
