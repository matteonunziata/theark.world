import type { Metadata } from "next";
import Link from "next/link";
import { ArkFonts } from "@/components/ark-fonts";
import { getViewer } from "@/lib/auth";
import { googleCalendarUrl } from "@/lib/calendar";
import { BOOKING_DAYS, courtMoney, levelName, levelRange, MOVE_LIMIT, type PriceItem, sportName } from "@/lib/courts";
import { addDays, fmtDate, fmtTime, todayIn } from "@/lib/dates";
import { siteUrl } from "@/lib/email";
import { stripeReady } from "@/lib/stripe";
import { AddEquipment, CopyLink, LeaveMatch, ManageBooking } from "./booking-actions";
import "../../courts.css";
import { SiteNavBar } from "../../../site/site-nav";

export const metadata: Metadata = { title: { absolute: "Your court booking — The ARK" }, robots: { index: false } };

type Page = {
  booking: {
    id: string;
    court: string;
    court_id: string;
    sport: string;
    date: string;
    start_time: string;
    end_time: string;
    status: string;
    minutes: number;
    private_pay: "whole" | "split" | null;
    share_token: string | null;
    moves_used: number;
    movable: boolean;
    started: boolean;
    open_match: boolean;
    level_min: number | null;
    level_max: number | null;
    spots: number | null;
    amount: number | null;
    currency: string;
    host: string;
    notes: string | null;
    held_until: string | null;
    cancellable: boolean;
  };
  you: {
    id: string;
    token: string;
    host: boolean;
    status: string;
    amount: number;
    due: number;
    paid: boolean;
    name: string;
    email: string | null;
    level: number | null;
    equipment: { label: string; price: number }[];
  } | null;
  players: { name: string; level: number | null; host: boolean; status: string }[];
};

export default async function CourtBookingPage({ params }: PageProps<"/courts/b/[token]">) {
  const { token } = await params;
  const { supabase } = await getViewer();
  const [{ data }, { data: org }, { data: priceData }, origin] = await Promise.all([
    supabase.rpc("court_booking_by_token", { p_token: token }),
    supabase.rpc("public_org").maybeSingle(),
    supabase.rpc("public_court_prices"),
    siteUrl(),
  ]);
  const priceList = (priceData ?? []) as PriceItem[];
  const prices = Object.fromEntries(priceList.filter((p) => p.kind === "court").map((p) => [p.minutes as number, Number(p.price)]));
  const d = data as Page | null;
  const timezone = org?.timezone ?? "America/Costa_Rica";
  const today = todayIn(timezone);

  const head = (
    <SiteNavBar here="/courts" />
  );

  if (!d || !d.you) {
    return (
      <main className="crts">
        <ArkFonts />
        {head}
        <div className="crts-card">
          <span className="crts-state bad">Not found</span>
          <h1>We couldn’t find that booking</h1>
          <p className="muted">The link may be incomplete. Check the email we sent, or book again.</p>
          <div className="acts">
            <Link className="btn solid" href="/courts">Back to the courts</Link>
          </div>
        </div>
      </main>
    );
  }

  const { booking: b, you, players } = d;
  const first = you.name.trim().split(/\s+/)[0] ?? "";
  const when = `${b.date === today ? "Today" : fmtDate(b.date, { weekday: "long", month: "long", day: "numeric" })}, ${fmtTime(b.start_time)}–${fmtTime(b.end_time)}`;
  const started = `${b.date}T${b.start_time}` < `${today}T${new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: timezone }).format(new Date())}`;
  const inCount = players.filter((p) => p.status === "in" || p.status === "held").length;
  const canPay = stripeReady() && Number(you.due) > 0 && ["held", "in"].includes(you.status) && ["held", "booked"].includes(b.status);
  const heldUntil = b.held_until
    ? new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: timezone }).format(new Date(b.held_until))
    : null;

  let state: [string, string, string];
  if (b.status === "cancelled" || you.status === "out") state = ["bad", "Cancelled", you.host ? "This booking was cancelled" : "You left this match"];
  else if (b.status === "expired" || you.status === "expired") state = ["bad", "Hold ran out", "The hold ran out before payment"];
  else if (b.status === "held" || you.status === "held") state = ["soon", "Holding", `Holding your ${you.host ? "court" : "spot"}${heldUntil ? ` until ${heldUntil}` : ""}`];
  else if (b.date < today) state = ["ok", "Played", `Thanks for coming${first ? `, ${first}` : ""}`];
  else state = ["ok", Number(you.due) <= 0 ? "Booked" : "Booked, not paid yet", `See you on court${first ? `, ${first}` : ""}`];

  const joinUrl = `${origin}/courts/join/${b.share_token ?? b.id}`;
  const manageUrl = `${origin}/courts/b/${you.token}`;
  const live = (b.status === "booked" || b.status === "held") && !started && !b.started;
  const spotsLeft = Math.max(0, (b.spots ?? 0) - players.length);
  const last = addDays(today, BOOKING_DAYS);
  const kind = b.open_match ? "Open match" : b.private_pay === "whole" ? "Private match · host pays the whole court" : "Private match · split";

  return (
    <main className="crts">
      <ArkFonts />
      {head}
      <div className="crts-card">
        <span className={`crts-state ${state[0]}`}>{state[1]}</span>
        <h1>{state[2]}</h1>
        <p className="muted">
          {b.court} · {sportName(b.sport)}
        </p>
        <div className="crts-rows">
          <div>
            <span>When</span>
            <span>{when}</span>
          </div>
          <div>
            <span>Where</span>
            <span>
              {org?.name ?? "The ARK"}, {org?.location ?? "Santa Teresa"}
            </span>
          </div>
          <div>
            <span>{b.open_match || b.private_pay === "split" || !you.host ? "Your share" : "Court"}</span>
            <span>{courtMoney(you.amount, b.currency)} <small>(VAT included)</small></span>
          </div>
          {you.equipment.map((e, i) => (
            <div key={i}>
              <span>{e.label}</span>
              <span>{courtMoney(e.price, b.currency)}</span>
            </div>
          ))}
          <div>
            <span>{Number(you.due) <= 0 ? "Paid" : "Still to pay"}</span>
            <span>{Number(you.due) <= 0 ? "All settled" : `${courtMoney(you.due, b.currency)}${canPay ? "" : ", settle at reception"}`}</span>
          </div>
          <div>
            <span>Match</span>
            <span>
              {kind}
              {b.open_match ? `, level ${levelRange(b.level_min, b.level_max)}` : ""} · {inCount} of {b.spots} players
            </span>
          </div>
          {b.notes && you.host && (
            <div>
              <span>Notes</span>
              <span>{b.notes}</span>
            </div>
          )}
        </div>

        {b.status === "expired" && (
          <p className="muted">Nothing was charged. The slot is free again, so you can book it once more if it’s still open.</p>
        )}
        {(b.status === "held" || you.status === "held") && (
          <p className="muted">Pay to confirm. If the time runs out, the slot goes back on the page and nothing is charged.</p>
        )}

        {b.status === "booked" && (
          <>
            <ul className="crts-players">
              {players.map((p, i) => (
                <li key={i}>
                  <span>
                    {p.name}
                    {p.host ? " (host)" : ""}
                  </span>
                  <small>
                    {p.level !== null ? `${p.level} · ${levelName(p.level)}` : ""}
                    {p.status === "held" ? " · paying" : ""}
                  </small>
                </li>
              ))}
              {Array.from({ length: spotsLeft }, (_, i) => (
                <li key={`e${i}`} className="empty">
                  <span>Open spot</span>
                  <small>{b.private_pay === "whole" ? "Add a name" : courtMoney(b.amount && b.spots ? Number(b.amount) / b.spots : 0, b.currency)}</small>
                </li>
              ))}
            </ul>
            {you.host && spotsLeft > 0 && live && (
              <div className="share">
                {b.open_match
                  ? "Your match is listed on the courts page. You can also send this link to anyone:"
                  : b.private_pay === "whole"
                    ? "Send this link to your friends so they can add their names. They have nothing to pay:"
                    : "Send this link to your friends so they can add their names and pay their share:"}
                <code>{joinUrl}</code>
                <CopyLink url={joinUrl} label="Copy join link" />
              </div>
            )}
          </>
        )}

        <div className="acts">
          {canPay && (
            <a className="btn solid" href={`/pay/court/${you.token}`}>
              Pay {courtMoney(you.due, b.currency)} now
            </a>
          )}
          {!you.host && live && ["in", "held"].includes(you.status) && <LeaveMatch token={you.token} />}
        </div>

        {live && ["in", "held"].includes(you.status) && b.status === "booked" && (
          <div style={{ marginTop: 16 }}>
            <AddEquipment token={you.token} items={priceList} />
          </div>
        )}

        {you.host && (b.status === "booked" || b.status === "held") && (
          <div className="manage-box">
            <h3>Your private link to manage this booking</h3>
            <p className="muted" style={{ margin: 0, fontSize: 14 }}>
              Save it. It’s how you move or cancel without logging in. We’ll ask for the phone number you booked with.
            </p>
            <code>{manageUrl}</code>
            <CopyLink url={manageUrl} label="Copy my link" />
            {live && (
              <div style={{ marginTop: 14 }}>
                <ManageBooking
                  token={you.token}
                  bookingId={b.id}
                  courtId={b.court_id}
                  current={{ date: b.date, start: b.start_time.slice(0, 5), minutes: b.minutes }}
                  today={today}
                  last={last}
                  prices={prices}
                  movable={b.movable && b.status === "booked"}
                  movesLeft={MOVE_LIMIT - b.moves_used}
                  cancellable={b.cancellable}
                />
              </div>
            )}
          </div>
        )}
        {(b.status === "booked" || b.status === "held") && !started && (
          <div className="cal">
            <a
              className="btn sm"
              href={googleCalendarUrl({
                title: `${b.court} · ${org?.name ?? "The ARK"}`,
                date: b.date,
                start: b.start_time,
                end: b.end_time,
                location: [org?.name, org?.location].filter(Boolean).join(", "),
                details: `Your booking: ${origin}/courts/b/${you.token}`,
                timeZone: timezone,
              })}
              target="_blank"
              rel="noopener noreferrer"
            >
              Google Calendar
            </a>
            <a className="btn sm" href={`/courts/b/${you.token}/calendar.ics`}>
              Apple or Outlook
            </a>
          </div>
        )}
        <p className="muted" style={{ fontSize: 13, marginTop: 18 }}>
          {you.host
            ? "Move up to 3 hours before the start (twice at most). Cancel up to 24 hours before and anything paid comes back to your card. Later than that, message us."
            : "Leave any time while the match isn’t full, otherwise up to 24 hours before. Anything paid comes back to your card."}
        </p>
      </div>
    </main>
  );
}
