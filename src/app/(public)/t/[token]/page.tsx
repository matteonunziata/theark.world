import type { Metadata } from "next";
import Link from "next/link";
import QRCode from "qrcode";
import { AddToCalendar } from "@/components/add-to-calendar";
import { ScanResult } from "@/components/scan-result";
import { PortalHead } from "@/components/portal-head";
import { SaveImageButton } from "@/components/save-image";
import { getViewer } from "@/lib/auth";
import { fmtDate, fmtTime, timeRange } from "@/lib/dates";
import { siteUrl, ticketCode, ticketUrl } from "@/lib/email";
import { kindName, money } from "@/lib/schedule";
import { stripeReady } from "@/lib/stripe";
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

export default async function TicketPage({ params, searchParams }: PageProps<"/t/[token]">) {
  const { token } = await params;
  const { look } = await searchParams;
  const { supabase, staff } = await getViewer();
  const [first, { data: org }] = await Promise.all([
    supabase.rpc("ticket_by_token", { p_token: token }).maybeSingle(),
    supabase.rpc("public_org").maybeSingle(),
  ]);
  let t = first.data;
  // Security scanning a valid ticket lets the person in: it's checked in right
  // away, so scanning it again shows "Already used". Links inside the app add
  // ?look=1 to open a ticket without checking it in.
  let admitted = false;
  if (t?.can_check_in && t.state === "valid" && !look) {
    const { error } = await supabase.rpc("check_in", { p_token: token });
    if (!error) {
      admitted = true;
      t = (await supabase.rpc("ticket_by_token", { p_token: token }).maybeSingle()).data ?? t;
    }
  }
  const orgName = org?.name ?? "The ARK";
  const head = (
    <PortalHead
      name={orgName}
      sub={staff ? "Security check" : "Your ticket"}
      link={staff ? { href: "/security", label: "Security console" } : undefined}
    />
  );

  if (!t) {
    return (
      <>
        {head}
        {staff && <ScanResult ok={false} title="Not valid" detail="This code isn’t on any booking." />}
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
  const at = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz });
  // What security needs to know, in as few words as possible.
  const scan: { title: string; detail: string } =
    admitted || t.state === "valid"
      ? { title: "Access approved", detail: `${t.title}, ${timeRange(t) || "today"}` }
      : ({
          used: { title: "Already used", detail: t.checked_in_at ? `Checked in at ${at(t.checked_in_at)}` : "" },
          early: { title: "Too early", detail: `Opens at ${fmtTime(t.gate_opens)}, an hour before ${t.title}` },
          upcoming: { title: "Not today", detail: `This ticket is for ${day}` },
          expired: { title: "Expired", detail: `This ticket was for ${day}` },
          cancelled: { title: "Cancelled", detail: `${t.title} was cancelled` },
        }[t.state] ?? { title: "Not valid", detail: "" });

  return (
    <>
      {head}
      {t.can_check_in && !look && (
        <ScanResult ok={admitted || t.state === "valid"} title={scan.title} name={t.holder} detail={scan.detail} />
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
          {stripeReady() && !t.paid && Number(t.price) > 0 && ["valid", "upcoming", "early"].includes(t.state) && (
            <p style={{ margin: "12px 0 0" }}>
              <a className="btn primary" href={`/pay/ticket/${token}`}>
                Pay {money(t.price, t.currency)}
              </a>
            </p>
          )}
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
