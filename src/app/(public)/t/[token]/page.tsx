import type { Metadata } from "next";
import Link from "next/link";
import QRCode from "qrcode";
import { AddToCalendar } from "@/components/add-to-calendar";
import { GateFlash } from "@/components/gate-flash";
import { PortalHead } from "@/components/portal-head";
import { SaveImageButton } from "@/components/save-image";
import { getViewer } from "@/lib/auth";
import { fmtDate, fmtTime, timeRange } from "@/lib/dates";
import { siteUrl, ticketCode, ticketUrl } from "@/lib/email";
import { kindName, money } from "@/lib/schedule";
import { walletEnabled } from "@/lib/wallet";
import { CheckInButton, CopyTicketLink } from "./ticket-actions";

export const metadata: Metadata = { title: "Ticket", robots: { index: false } };

const STATE: Record<string, [string, string]> = {
  valid: ["ok", "Valid today"],
  upcoming: ["soon", "Valid on the day"],
  early: ["soon", "Too early"],
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
        {staff && <GateFlash ok={false} title="Not a valid ticket" detail="This code isn’t on any booking." />}
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
  const tz = org?.timezone ?? "America/Costa_Rica";
  const day = fmtDate(t.session_date, { weekday: "long", month: "long", day: "numeric" });
  // Why the gate is (or isn't) letting this ticket through.
  const why: Record<string, string> = {
    valid: `${t.title}, ${timeRange(t) || "today"}`,
    early: `Entry opens at ${fmtTime(t.gate_opens)}, an hour before ${t.title} starts.`,
    upcoming: `This ticket is for ${day}.`,
    expired: `This ticket was for ${day}.`,
    used: t.checked_in_at
      ? `Already checked in at ${new Date(t.checked_in_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz })}.`
      : "Already checked in.",
    cancelled: "This session was cancelled.",
  };

  return (
    <>
      {head}
      {t.can_check_in && (
        <GateFlash
          ok={t.state === "valid"}
          title={t.state === "valid" ? `Valid · ${t.holder.split(/\s+/)[0]}` : (t.state === "used" ? "Already used" : label)}
          detail={`${t.holder} · ${why[t.state] ?? ""}`}
          action={t.state === "valid" ? <CheckInButton token={token} className="gf-btn" /> : undefined}
        />
      )}
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
          {t.state === "early" && (
            <p className="muted" style={{ fontSize: 13.5, margin: "10px 0 0" }}>
              Entry opens at {fmtTime(t.gate_opens)}, an hour before the start.
            </p>
          )}
          <div className="acts">
            {t.can_check_in && t.state === "valid" && <CheckInButton token={token} />}
            {(t.state === "valid" || t.state === "upcoming" || t.state === "early") && (
              <SaveImageButton href={`/t/${token}/image.png`} filename="ARK ticket.png" />
            )}
            <CopyTicketLink url={url} />
          </div>
          {walletEnabled() && (t.state === "valid" || t.state === "upcoming" || t.state === "early") && (
            <a className="wallet-btn" href={`/t/${token}/wallet.pkpass`}>
              Add to Apple Wallet
            </a>
          )}
          {(t.state === "valid" || t.state === "upcoming" || t.state === "early") && (
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
            Security scans the code with any phone camera. It works on the day
            of the session, from an hour before it starts.
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
