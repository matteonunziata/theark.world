"use client";

import Link from "next/link";
import { AddToCalendar } from "@/components/add-to-calendar";
import { useState, useTransition } from "react";
import { type Attendee, Going } from "@/components/going";
import type { Tables } from "@/lib/database.types";
import { dayLabel, timeRange } from "@/lib/dates";
import { money } from "@/lib/schedule";
import { type BookingResult, bookSession } from "../../actions";

type Ticket = Tables<"ticket_types">;
type Count = { session_date: string; ticket_type_id: string | null; taken: number };
export function BookingPanel({
  offering: o,
  sessions,
  attendees = {},
  counts,
  tickets,
  highlight,
  startOn,
  today,
  isMember,
  canBook,
  loginHref,
  onBooked,
}: {
  offering: {
    id: string;
    title: string;
    start_time: string | null;
    end_time: string | null;
    location: string | null;
    capacity: number | null;
  };
  sessions: { date: string; cancelled: boolean; closed?: boolean }[];
  /** Directory members booked per date; members and staff only. */
  attendees?: Record<string, Attendee[]>;
  counts: Count[];
  tickets: Ticket[];
  highlight: string | null;
  /** Open straight on the booking form for this date, when it can be booked. */
  startOn?: string | null;
  today: string;
  isMember: boolean;
  canBook: boolean;
  loginHref: string;
  onBooked?: () => void;
}) {
  const [picked, setPicked] = useState<string | null>(() => {
    const s = startOn ? sessions.find((x) => x.date === startOn) : null;
    if (!s || s.cancelled || s.closed || !canBook) return null;
    const cap = o.capacity;
    const n = counts.filter((c) => c.session_date === s.date).reduce((a, c) => a + Number(c.taken), 0);
    return cap && n >= cap ? null : s.date;
  });
  const [result, setResult] = useState<BookingResult | null>(null);
  const [pending, start] = useTransition();
  const [leaving, setLeaving] = useState(false);

  const taken = (d: string) =>
    counts.filter((c) => c.session_date === d).reduce((n, c) => n + Number(c.taken), 0);
  const left = (d: string) => (o.capacity ? Math.max(0, o.capacity - taken(d)) : null);
  const ticketLeft = (t: Ticket, d: string) =>
    t.qty
      ? Math.max(
          0,
          t.qty -
            Number(counts.find((c) => c.session_date === d && c.ticket_type_id === t.id)?.taken ?? 0),
        )
      : null;

  if (result?.ok && result.held) {
    // Meals: the spot is held until it's paid. Online, that means straight to Stripe.
    return (
      <section className="panel">
        <div className="done-msg">
          <p className="muted">{leaving ? "Taking you to payment…" : "Your spot is held"}</p>
          <p className="big">{o.title}</p>
          <p>
            {picked && dayLabel(picked, today)}, {timeRange(o)}
          </p>
          {result.payUrl ? (
            <>
              <p className="muted">
                Your pass is issued once the payment goes through. The spot is held for 30 minutes.
                Then show your pass to the team at La Cocineta.
              </p>
              <p>
                <a className="btn primary" href={result.payUrl}>
                  {result.price ? `Pay ${result.price}` : "Pay now"}
                </a>
              </p>
            </>
          ) : result.paymentLink ? (
            <>
              <p className="muted">Pay through the link and we’ll confirm your booking once the payment is in.</p>
              <p>
                <a className="btn primary" href={result.paymentLink} target="_blank" rel="noopener noreferrer">
                  {result.price ? `Pay ${result.price}` : `Pay for ${o.title.toLowerCase()}`}
                </a>
              </p>
            </>
          ) : (
            <p className="muted">Pay at the front desk and we’ll confirm your booking.</p>
          )}
          <p>
            <Link className="btn" href={`/t/${result.token}`}>
              View your booking
            </Link>
          </p>
        </div>
      </section>
    );
  }

  if (result?.ok) {
    return (
      <section className="panel">
        <div className="done-msg">
          <p className="muted">You’re booked</p>
          <p className="big">{o.title}</p>
          <p>
            {picked && dayLabel(picked, today)}, {timeRange(o)}
          </p>
          <p className="muted">
            {result.emailed
              ? "Your ticket is on its way to your inbox."
              : "Keep your ticket handy. Show it to security when you arrive."}
          </p>
          {isMember && picked && <Going list={attendees[picked] ?? []} taken={taken(picked)} />}
          <p>
            <Link className="btn" href={`/t/${result.token}`}>
              View your ticket
            </Link>
          </p>
          {picked && (
            <AddToCalendar
              icsHref={`/t/${result.token}/calendar.ics`}
              event={{
                title: o.title,
                date: picked,
                start: o.start_time,
                end: o.end_time,
                location: o.location,
                details: `Your ticket: ${typeof window === "undefined" ? "" : window.location.origin}/t/${result.token}`,
              }}
            />
          )}
          <p />
          {result.payUrl ? (
            <>
              <a className="btn primary" href={result.payUrl}>
                Pay {result.price} now
              </a>
              <p className="muted" style={{ marginTop: 8 }}>
                Your spot is held. You can also pay from your ticket later, or at the front desk.
              </p>
            </>
          ) : result.paymentLink ? (
            <a className="btn primary" href={result.paymentLink} target="_blank" rel="noopener noreferrer">
              {result.price ? `Pay ${result.price}` : `Pay for ${o.title.toLowerCase()}`}
            </a>
          ) : (
            result.price && <p className="muted">Pay {result.price} at the front desk when you arrive.</p>
          )}
        </div>
      </section>
    );
  }

  if (picked) {
    const firstOpen = tickets.find((t) => ticketLeft(t, picked) !== 0);
    // Meals and the like: everyone, members included, pays when booking.
    const payFirst = tickets.length > 0 && tickets.every((t) => t.pay_first);
    const payFirstPrice = payFirst && firstOpen && Number(firstOpen.price) > 0 ? money(firstOpen.price, firstOpen.currency) : null;
    return (
      <section className="panel">
        <h2>Book {o.title}</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          {dayLabel(picked, today)}, {timeRange(o)}
          {o.location ? ` at ${o.location}` : ""}
        </p>
        {isMember && <Going list={attendees[picked] ?? []} taken={taken(picked)} />}
        {result && !result.ok && (
          <div className="form-error" role="alert">
            {result.error}
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            start(async () => {
              const r = await bookSession({
                offeringId: o.id,
                date: picked,
                name: String(fd.get("name") ?? ""),
                email: String(fd.get("email") ?? ""),
                ticketTypeId: (fd.get("ticket") as string) || null,
                website: String(fd.get("ms_trap_x") ?? ""),
              });
              setResult(r);
              if (r.ok) onBooked?.();
              if (r.ok && r.held && r.payUrl) {
                setLeaving(true);
                window.location.assign(r.payUrl);
              }
            });
          }}
        >
          {!isMember && (
            <>
              <div className="fld">
                <label htmlFor="b-name">Your name</label>
                <input id="b-name" name="name" autoComplete="name" required />
              </div>
              <div className="fld">
                <label htmlFor="b-email">Email</label>
                <input id="b-email" name="email" type="email" autoComplete="email" required />
                <span className="hint">We’ll email your ticket here.</span>
              </div>
            </>
          )}
          <input name="ms_trap_x" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: "absolute", left: -9999 }} />
          {payFirst && firstOpen ? (
            <>
              <input type="hidden" name="ticket" value={firstOpen.id} />
              <p className="note" style={{ marginTop: 0 }}>
                {o.title} is paid when you book{payFirstPrice ? ` (${payFirstPrice})` : ""}. You’ll go to the payment page
                next, and your pass is issued once the payment goes through. Show it to the team at La
                Cocineta.
              </p>
            </>
          ) : tickets.length > 0 && (
            <fieldset className="fld" style={{ border: 0, padding: 0 }}>
              <legend style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 6 }}>Ticket</legend>
              <div className="tkpick">
                {isMember && (
                  <label>
                    <input type="radio" name="ticket" value="" defaultChecked />
                    <b>I’m a member</b>
                    <span>Included</span>
                  </label>
                )}
                {tickets.map((t) => {
                  const l = ticketLeft(t, picked);
                  return (
                    <label key={t.id} className={l === 0 ? "off" : ""}>
                      <input
                        type="radio"
                        name="ticket"
                        value={t.id}
                        disabled={l === 0}
                        defaultChecked={!isMember && firstOpen?.id === t.id}
                      />
                      <b>{t.name}</b>
                      <span>
                        {money(t.price, t.currency)}
                        {l === 0 ? ", sold out" : ""}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}
          <div className="book-acts">
            <button type="button" className="btn ghost" onClick={() => setPicked(null)}>
              Other dates
            </button>
            <button type="submit" className="btn primary" disabled={pending}>
              {pending ? "Booking…" : payFirst ? "Book and pay" : "Confirm booking"}
            </button>
          </div>
        </form>
      </section>
    );
  }

  return (
    <section className="panel">
      <h2>{sessions.length > 1 ? "Upcoming dates" : "Date"}</h2>
      {!canBook && (
        <div className="banner">
          This is for members. <Link href={loginHref}>Sign in</Link> to book.
        </div>
      )}
      {sessions.length ? (
        sessions.map((s) => {
          const l = left(s.date);
          const off = s.cancelled || s.closed || l === 0 || !canBook;
          return (
            <div
              className="drow"
              key={s.date}
              style={
                s.date === highlight
                  ? { background: "var(--surface-2)", margin: "0 -10px", padding: "12px 10px", borderRadius: 10 }
                  : undefined
              }
            >
              <div>
                <b>{dayLabel(s.date, today)}</b>
                <span>
                  {timeRange(o)}
                  {s.cancelled
                    ? ", cancelled"
                    : s.closed
                      ? ", booking closed"
                      : l === 0
                      ? ", full"
                      : l !== null
                        ? `, ${l} ${l === 1 ? "spot" : "spots"} left`
                        : ""}
                </span>
                {isMember && <Going list={attendees[s.date] ?? []} taken={taken(s.date)} />}
              </div>
              <button
                type="button"
                className={`btn ${off ? "" : "primary"}`}
                disabled={off}
                onClick={() => {
                  setResult(null);
                  setPicked(s.date);
                }}
              >
                {s.cancelled ? "Cancelled" : s.closed ? "Closed" : l === 0 ? "Full" : "Book"}
              </button>
            </div>
          );
        })
      ) : (
        <p className="muted" style={{ margin: 0 }}>No upcoming dates right now.</p>
      )}
    </section>
  );
}
