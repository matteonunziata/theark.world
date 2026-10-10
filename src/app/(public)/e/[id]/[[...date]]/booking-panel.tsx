"use client";

import Link from "next/link";
import { AddToCalendar } from "@/components/add-to-calendar";
import { useState, useTransition } from "react";
import { type Attendee, Going } from "@/components/going";
import type { Tables } from "@/lib/database.types";
import { dayLabel, timeRange } from "@/lib/dates";
import { money } from "@/lib/schedule";
import { type BookingResult, bookSession } from "../../actions";
import { PaymentStep } from "./payment-step";

type Ticket = Tables<"ticket_types">;
type Count = { session_date: string; ticket_type_id: string | null; taken: number };
export function BookingPanel({
  offering: o,
  sessions,
  attendees = {},
  counts,
  tickets,
  availability,
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
  /** Every ticket type, main admission and add-ons. */
  tickets: Ticket[];
  /** Per date and ticket: how many are taken and whether it's on sale. */
  availability: Record<string, Record<string, { state: string; taken: number }>>;
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
  // Paying inside the page: shown right after booking when Stripe's form is available.
  const [payStep, setPayStep] = useState(false);
  const [paid, setPaid] = useState<"paid" | "pending" | "unknown" | null>(null);

  const taken = (d: string) =>
    counts.filter((c) => c.session_date === d).reduce((n, c) => n + Number(c.taken), 0);
  const left = (d: string) => (o.capacity ? Math.max(0, o.capacity - taken(d)) : null);
  const ticketLeft = (t: Ticket, d: string) =>
    t.qty ? Math.max(0, t.qty - (availability[d]?.[t.id]?.taken ?? 0)) : null;
  const stateOf = (t: Ticket, d: string) => availability[d]?.[t.id]?.state ?? "ok";
  const [qty, setQty] = useState<Record<string, number>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const setTicketQty = (id: string, n: number) => setQty((q) => ({ ...q, [id]: n }));

  if (result?.ok && result.embedded && payStep && !paid) {
    return (
      <section className="panel">
        <h2>Payment</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          {o.title}, {picked && dayLabel(picked, today)}, {timeRange(o)}
          {result.summary ? ` · ${result.summary}` : ""}
        </p>
        <PaymentStep token={result.token} onPaid={(state) => { setPaid(state); setPayStep(false); }} />
        {result.held ? (
          <p className="muted" style={{ marginBottom: 0 }}>Your spot is held for 30 minutes while you pay.</p>
        ) : (
          <p style={{ marginBottom: 0 }}>
            <button type="button" className="linkish" onClick={() => setPayStep(false)}>
              Pay later at the front desk
            </button>
          </p>
        )}
      </section>
    );
  }

  if (result?.ok && result.held && !paid) {
    // Meals: the spot is held until it's paid. Online, that means straight to Stripe.
    return (
      <section className="panel">
        <div className="done-msg">
          <p className="muted">{leaving ? "Taking you to payment…" : "Your spot is held"}</p>
          <p className="big">{o.title}</p>
          <p>
            {picked && dayLabel(picked, today)}, {timeRange(o)}
          </p>
          {result.summary && <p>{result.summary}</p>}
          {result.payUrl ? (
            <>
              <p className="muted">
                Your pass is issued once the payment goes through. The spot is held for 30 minutes.
                Then show your pass to the team at La Cocineta.
              </p>
              <p>
                {result.embedded ? (
                  <button type="button" className="btn primary" onClick={() => setPayStep(true)}>
                    {result.price ? `Pay ${result.price}` : "Pay now"}
                  </button>
                ) : (
                  <a className="btn primary" href={result.payUrl}>
                    {result.price ? `Pay ${result.price}` : "Pay now"}
                  </a>
                )}
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
          {result.summary && <p>{result.summary}</p>}
          <p className="muted">
            {paid === "paid"
              ? "Payment received. Your ticket is on its way to your inbox."
              : paid === "pending"
                ? "Your bank is still confirming the payment. We’ll email your ticket as soon as it clears."
                : paid === "unknown"
                  ? "We’re confirming your payment. If you were charged, your receipt and ticket will arrive by email shortly."
                  : result.emailed
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
          {paid ? null : result.payUrl ? (
            <>
              {result.embedded ? (
                <button type="button" className="btn primary" onClick={() => setPayStep(true)}>
                  Pay {result.price} now
                </button>
              ) : (
                <a className="btn primary" href={result.payUrl}>
                  Pay {result.price} now
                </a>
              )}
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
    const mains = tickets.filter((t) => t.kind === "main");
    const addons = tickets.filter((t) => t.kind === "addon");
    const seatsLeft = left(picked);
    const chosen = tickets.filter((t) => (qty[t.id] ?? 0) > 0);
    const mainSeats = mains.reduce((n, t) => n + (qty[t.id] ?? 0), 0);
    const total = chosen.reduce((n, t) => n + Number(t.price) * (qty[t.id] ?? 0), 0);
    const currencies = [...new Set(chosen.map((t) => t.currency))];
    const totalLabel =
      currencies.length === 1 ? money(total, currencies[0]) : currencies.length ? "Mixed currencies" : null;
    // Meals and the like: everyone, members included, pays when booking.
    const payFirst = mains.length > 0 && mains.every((t) => t.pay_first);
    // Most of a ticket this booking can take: its own limit, stock, and (main) the spots left.
    const maxFor = (t: Ticket) => {
      const stock = ticketLeft(t, picked);
      let m = Math.min(t.max_per_order, stock ?? Infinity);
      if (t.kind === "main" && seatsLeft !== null) m = Math.min(m, seatsLeft - (mainSeats - (qty[t.id] ?? 0)));
      return Math.max(0, m);
    };
    const noteFor = (t: Ticket) => {
      const st = stateOf(t, picked);
      if (st === "sold_out" || ticketLeft(t, picked) === 0) return "Sold out";
      if (st === "not_started") return t.sales_start ? `On sale ${t.sales_start.slice(0, 10)}` : "Not on sale yet";
      if (st === "ended") return "Sales ended";
      if (st === "locked") return "Opens when earlier tickets sell out";
      return null;
    };
    const row = (t: Ticket) => {
      const note = noteFor(t);
      const n = qty[t.id] ?? 0;
      const max = maxFor(t);
      return (
        <div className={`tkrow${note ? " off" : ""}`} key={t.id}>
          <div>
            <b>{t.name}</b>
            <span>
              {money(t.price, t.currency)}
              {note ? `, ${note.toLowerCase()}` : ""}
            </span>
          </div>
          <div className="stepper" role="group" aria-label={`${t.name} quantity`}>
            <button type="button" aria-label={`Fewer ${t.name}`} disabled={!!note || n <= 0} onClick={() => setTicketQty(t.id, n - 1)}>
              −
            </button>
            <output aria-live="polite">{n}</output>
            <button type="button" aria-label={`More ${t.name}`} disabled={!!note || n >= max} onClick={() => setTicketQty(t.id, n + 1)}>
              +
            </button>
          </div>
        </div>
      );
    };
    return (
      <section className="panel">
        <h2>Book {o.title}</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          {dayLabel(picked, today)}, {timeRange(o)}
          {o.location ? ` at ${o.location}` : ""}
          {sessions.length > 1 && (
            <>
              {" · "}
              <button type="button" className="linkish" onClick={() => setPicked(null)}>
                Change date
              </button>
            </>
          )}
        </p>
        {isMember && <Going list={attendees[picked] ?? []} taken={taken(picked)} />}
        {(formError || (result && !result.ok)) && (
          <div className="form-error" role="alert">
            {formError ?? (result && !result.ok ? result.error : null)}
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setFormError(null);
            const fd = new FormData(e.currentTarget);
            if (mains.length > 0 && !isMember && mainSeats === 0) {
              setFormError(addons.some((t) => (qty[t.id] ?? 0) > 0) ? "Choose a main ticket first. Add-ons come with one." : "Choose at least one ticket.");
              return;
            }
            if (chosen.length > 0 && mainSeats === 0) {
              setFormError("Choose a main ticket first. Add-ons come with one.");
              return;
            }
            start(async () => {
              const r = await bookSession({
                offeringId: o.id,
                date: picked,
                name: String(fd.get("name") ?? ""),
                email: String(fd.get("email") ?? ""),
                phone: String(fd.get("phone") ?? ""),
                items: chosen.map((t) => ({ ticketTypeId: t.id, qty: qty[t.id] ?? 0 })),
                website: String(fd.get("ms_trap_x") ?? ""),
              });
              setResult(r);
              setPaid(null);
              if (r.ok) onBooked?.();
              // Pay inside the page when we can; otherwise held bookings go to Stripe's page.
              if (r.ok && r.embedded) setPayStep(true);
              else if (r.ok && r.held && r.payUrl) {
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
              <div className="fld">
                <label htmlFor="b-phone">Phone (WhatsApp preferred)</label>
                <input id="b-phone" name="phone" type="tel" autoComplete="tel" required />
              </div>
            </>
          )}
          <input name="ms_trap_x" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: "absolute", left: -9999 }} />
          {payFirst && (
            <p className="note" style={{ marginTop: 0 }}>
              {o.title} is paid when you book. You’ll go to the payment page next, and your pass is issued once
              the payment goes through.
            </p>
          )}
          {tickets.length > 0 && (
            <fieldset className="fld" style={{ border: 0, padding: 0 }}>
              <legend style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 6 }}>Tickets</legend>
              {isMember && (
                <p className="note" style={{ margin: "0 0 8px" }}>
                  Members are included. Choose tickets only if you’re paying, for example for guests.
                </p>
              )}
              <div className="tkpick">{mains.map(row)}</div>
              {addons.length > 0 && (
                <>
                  <legend style={{ fontSize: 13.5, fontWeight: 600, margin: "12px 0 6px" }}>Optional extras</legend>
                  <div className="tkpick">{addons.map(row)}</div>
                </>
              )}
            </fieldset>
          )}
          {totalLabel && (
            <div className="tk" style={{ borderTop: "1px solid var(--line)", marginTop: 8 }}>
              <div>
                <b>Total</b>
                <span>{chosen.map((t) => `${qty[t.id]} × ${t.name}`).join(", ")}</span>
              </div>
              <div>
                <b>{totalLabel}</b>
              </div>
            </div>
          )}
          <div className="book-acts">
            <button type="submit" className="btn primary" disabled={pending}>
              {pending ? "Booking…" : payFirst || total > 0 ? "Book and pay" : "Confirm booking"}
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
