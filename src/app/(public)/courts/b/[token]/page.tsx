import type { Metadata } from "next";
import Link from "next/link";
import { ArkFonts } from "@/components/ark-fonts";
import { Logo } from "@/components/logo";
import { getViewer } from "@/lib/auth";
import { googleCalendarUrl } from "@/lib/calendar";
import { courtMoney, levelName, levelRange, sportName } from "@/lib/courts";
import { fmtDate, fmtTime, todayIn } from "@/lib/dates";
import { siteUrl } from "@/lib/email";
import { stripeReady } from "@/lib/stripe";
import { BookingActions } from "./booking-actions";
import "../../courts.css";

export const metadata: Metadata = { title: { absolute: "Your court booking — The ARK" }, robots: { index: false } };

type Page = {
  booking: {
    id: string;
    court: string;
    sport: string;
    date: string;
    start_time: string;
    end_time: string;
    status: string;
    open_match: boolean;
    level_min: number | null;
    level_max: number | null;
    spots: number | null;
    amount: number | null;
    currency: string;
    paid: boolean;
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
    paid: boolean;
    name: string;
    email: string | null;
    level: number | null;
  } | null;
  players: { name: string; level: number | null; host: boolean; status: string; paid: boolean }[];
};

export default async function CourtBookingPage({ params }: PageProps<"/courts/b/[token]">) {
  const { token } = await params;
  const { supabase } = await getViewer();
  const [{ data }, { data: org }, origin] = await Promise.all([
    supabase.rpc("court_booking_by_token", { p_token: token }),
    supabase.rpc("public_org").maybeSingle(),
    siteUrl(),
  ]);
  const d = data as Page | null;
  const timezone = org?.timezone ?? "America/Costa_Rica";
  const today = todayIn(timezone);

  const head = (
    <header className="crts-nav">
      <Link href="/courts" aria-label="The ARK courts">
        <Logo tone="dark" height={32} />
      </Link>
      <nav>
        <Link href="/courts" className="btn sm">Book another</Link>
      </nav>
    </header>
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
  const canPay = stripeReady() && !you.paid && Number(you.amount) > 0 && ["held", "in"].includes(you.status) && ["held", "booked"].includes(b.status);
  const heldUntil = b.held_until
    ? new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: timezone }).format(new Date(b.held_until))
    : null;

  let state: [string, string, string];
  if (b.status === "cancelled" || you.status === "out") state = ["bad", "Cancelled", you.host ? "This booking was cancelled" : "You left this match"];
  else if (b.status === "expired" || you.status === "expired") state = ["bad", "Hold ran out", "The hold ran out before payment"];
  else if (b.status === "held" || you.status === "held") state = ["soon", "Holding", `Holding your ${you.host ? "court" : "spot"}${heldUntil ? ` until ${heldUntil}` : ""}`];
  else if (b.date < today) state = ["ok", "Played", `Thanks for coming${first ? `, ${first}` : ""}`];
  else state = ["ok", you.paid || Number(you.amount) === 0 ? "Booked" : "Booked, unpaid", `See you on court${first ? `, ${first}` : ""}`];

  const joinUrl = `${origin}/courts/join/${b.id}`;
  const cancellable =
    (you.host && b.cancellable) ||
    (!you.host && ["in", "held"].includes(you.status) && b.status === "booked" && !started);

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
            <span>{b.open_match ? "Your share" : "Price"}</span>
            <span>
              {courtMoney(you.amount, b.currency)}
              {Number(you.amount) > 0 ? (you.paid ? ", paid" : canPay ? ", not paid yet" : ", settle at reception") : ""}
            </span>
          </div>
          {b.open_match && (
            <div>
              <span>Match</span>
              <span>
                Open match, level {levelRange(b.level_min, b.level_max)}, {inCount} of {b.spots} players
              </span>
            </div>
          )}
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

        {b.open_match && b.status === "booked" && (
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
              {Array.from({ length: Math.max(0, (b.spots ?? 0) - players.length) }, (_, i) => (
                <li key={`e${i}`} className="empty">
                  <span>Open spot</span>
                  <small>{courtMoney(b.amount && b.spots ? Number(b.amount) / b.spots : 0, b.currency)}</small>
                </li>
              ))}
            </ul>
            {players.length < (b.spots ?? 0) && !started && (
              <div className="share">
                Share this link so people can join:
                <code>{joinUrl}</code>
              </div>
            )}
          </>
        )}

        <div className="acts">
          {canPay && (
            <a className="btn solid" href={`/pay/court/${you.token}`}>
              Pay {courtMoney(you.amount, b.currency)} now
            </a>
          )}
          {cancellable && <BookingActions token={you.token} host={you.host} joinUrl={b.open_match ? joinUrl : null} />}
          {!cancellable && b.open_match && b.status === "booked" && !started && <BookingActions token={you.token} host={you.host} joinUrl={joinUrl} copyOnly />}
        </div>
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
            ? "Cancel up to 24 hours before the start and anything paid comes back to your card. Later than that, message us."
            : "Leave any time while the match isn’t full, otherwise up to 24 hours before. Anything paid comes back to your card."}
        </p>
      </div>
    </main>
  );
}
