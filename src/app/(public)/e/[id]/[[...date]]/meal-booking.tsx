"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { Tables } from "@/lib/database.types";
import { dayLabel, timeRange } from "@/lib/dates";
import { lineKey, useMealCart } from "@/lib/meal-cart";
import { money } from "@/lib/schedule";
import { bookMeals, releaseOrder, type CartResult } from "../../actions";
import { PaymentStep } from "./payment-step";

type Ticket = Tables<"ticket_types">;
type Count = { session_date: string; ticket_type_id: string | null; taken: number };
type Paid = "paid" | "pending" | "unknown";

/**
 * Breakfast and lunch: pick a day, say how many meals, add them to the cart, and do it again
 * for other days (or the other meal). One checkout and one payment cover the whole cart.
 * The cart lives in the browser, so it is shared by the breakfast and lunch pages and the
 * portal's booking window. Spots are only held once checkout starts.
 */
export function MealBooking({
  offering: o,
  sessions,
  counts,
  ticket,
  availability,
  today,
  isMember,
  canBook,
  loginHref,
  onBooked,
}: {
  offering: { id: string; title: string; start_time: string | null; end_time: string | null; location: string | null; capacity: number | null };
  sessions: { date: string; cancelled: boolean; closed?: boolean }[];
  counts: Count[];
  ticket: Ticket;
  availability: Record<string, Record<string, { state: string; taken: number }>>;
  today: string;
  isMember: boolean;
  canBook: boolean;
  loginHref: string;
  onBooked?: () => void;
}) {
  const cart = useMealCart();
  const [picked, setPicked] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<Extract<CartResult, { ok: true }> | null>(null);
  const [payStep, setPayStep] = useState(false);
  const [done, setDone] = useState<{ bookings: Extract<CartResult, { ok: true }>["bookings"]; paid: Paid } | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [pending, start] = useTransition();

  const taken = (d: string) => counts.filter((c) => c.session_date === d).reduce((n, c) => n + Number(c.taken), 0);
  const left = (d: string) => (o.capacity ? Math.max(0, o.capacity - taken(d)) : null);
  const inCart = (d: string) =>
    cart.lines.filter((l) => l.offeringId === o.id && l.date === d && l.ticketTypeId === ticket.id).reduce((n, l) => n + l.qty, 0);
  /** Most meals still to add for a day: the per-booking limit, stock and spots, less what is already in the cart. */
  const maxFor = (d: string) => {
    const stock = ticket.qty ? Math.max(0, ticket.qty - (availability[d]?.[ticket.id]?.taken ?? 0)) : Infinity;
    const spots = left(d) ?? Infinity;
    return Math.max(0, Math.min(ticket.max_per_order, stock, spots) - inCart(d));
  };
  const state = (d: string) => availability[d]?.[ticket.id]?.state ?? "ok";

  const currencies = [...new Set(cart.lines.map((l) => l.currency))];
  const total = cart.lines.reduce((n, l) => n + l.price * l.qty, 0);
  const meals = cart.lines.reduce((n, l) => n + l.qty, 0);
  const totalLabel = currencies.length === 1 ? money(total, currencies[0]) : null;

  const paying = order && order.embedded && payStep;
  if (done) {
    return (
      <section className="panel">
        <div className="done-msg">
          <p className="muted">You’re booked</p>
          <p className="big">{done.bookings.reduce((n, b) => n + b.qty, 0)} {done.bookings.reduce((n, b) => n + b.qty, 0) === 1 ? "meal" : "meals"}</p>
          {done.bookings.map((b) => (
            <p key={b.token} style={{ margin: "4px 0" }}>
              <Link href={`/t/${b.token}`}>
                {b.qty} × {b.title}, {dayLabel(b.date, today)}
              </Link>
            </p>
          ))}
          <p className="muted">
            {done.paid === "paid"
              ? "Payment received. A pass for each booking is on its way to your inbox."
              : done.paid === "pending"
                ? "Your bank is still confirming the payment. We’ll email your passes as soon as it clears."
                : "We’re confirming your payment. If you were charged, your receipt and passes will arrive by email shortly."}
          </p>
          <p>
            <button type="button" className="btn" onClick={() => setDone(null)}>
              Book more meals
            </button>
          </p>
        </div>
      </section>
    );
  }

  if (order && (payStep || leaving)) {
    return (
      <section className="panel">
        <h2>Payment</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          {leaving ? "Taking you to payment…" : `${order.bookings.reduce((n, b) => n + b.qty, 0)} meals${order.price ? ` · ${order.price}` : ""}`}
        </p>
        {paying && (
          <PaymentStep
            token={order.token}
            onPaid={(s) => {
              cart.clear();
              onBooked?.();
              setDone({ bookings: order.bookings, paid: s });
              setOrder(null);
              setPayStep(false);
            }}
          />
        )}
        {!leaving && (
          <p className="muted" style={{ marginBottom: 0 }}>
            Your spots are held for 30 minutes while you pay.{" "}
            <button
              type="button"
              className="linkish"
              onClick={() =>
                start(async () => {
                  await releaseOrder(order.orderId);
                  setOrder(null);
                  setPayStep(false);
                })
              }
            >
              Change my cart
            </button>
          </p>
        )}
      </section>
    );
  }

  const add = () => {
    if (!picked) return;
    cart.add({
      offeringId: o.id,
      offeringTitle: o.title,
      time: timeRange(o),
      date: picked,
      ticketTypeId: ticket.id,
      ticketName: ticket.name,
      price: Number(ticket.price),
      currency: ticket.currency,
      qty,
    });
    setPicked(null);
    setQty(1);
    setError(null);
  };

  const checkout = (fd: FormData) => {
    setError(null);
    start(async () => {
      const r = await bookMeals({
        lines: cart.lines.map((l) => ({ offeringId: l.offeringId, date: l.date, ticketTypeId: l.ticketTypeId, qty: l.qty })),
        name: String(fd.get("name") ?? ""),
        email: String(fd.get("email") ?? ""),
        phone: String(fd.get("phone") ?? ""),
        website: String(fd.get("ms_trap_x") ?? ""),
      });
      if (!r.ok) return setError(r.error);
      setOrder(r);
      if (r.embedded) setPayStep(true);
      else if (r.payUrl) {
        setLeaving(true);
        window.location.assign(r.payUrl);
      } else {
        // Online payment is off: the spots are held and the team takes payment at the front desk.
        cart.clear();
        onBooked?.();
        setDone({ bookings: r.bookings, paid: "unknown" });
        setOrder(null);
      }
    });
  };

  const maxPicked = picked ? maxFor(picked) : 0;
  return (
    <>
      {picked ? (
        <section className="panel">
          <h2>Add {o.title.toLowerCase()} to your cart</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            {dayLabel(picked, today)}, {timeRange(o)}
            {o.location ? ` at ${o.location}` : ""}
            {" · "}
            <button type="button" className="linkish" onClick={() => setPicked(null)}>
              Change date
            </button>
          </p>
          <div className="tkrow">
            <div>
              <b>How many meals?</b>
              <span>{money(ticket.price, ticket.currency)} each</span>
            </div>
            <div className="stepper" role="group" aria-label="Number of meals">
              <button type="button" aria-label="Fewer meals" disabled={qty <= 1} onClick={() => setQty(qty - 1)}>
                −
              </button>
              <output aria-live="polite">{Math.min(qty, Math.max(1, maxPicked))}</output>
              <button type="button" aria-label="More meals" disabled={qty >= maxPicked} onClick={() => setQty(qty + 1)}>
                +
              </button>
            </div>
          </div>
          <div className="book-acts">
            <button type="button" className="btn primary" disabled={maxPicked < 1} onClick={add}>
              Add to cart · {money(Number(ticket.price) * Math.min(qty, Math.max(1, maxPicked)), ticket.currency)}
            </button>
          </div>
        </section>
      ) : (
        <section className="panel">
          <h2>{sessions.length > 1 ? "Choose a day" : "Date"}</h2>
          {!canBook && (
            <div className="banner">
              This is for members. <Link href={loginHref}>Sign in</Link> to book.
            </div>
          )}
          {sessions.length ? (
            sessions.map((s) => {
              const l = left(s.date);
              const st = state(s.date);
              const m = maxFor(s.date);
              const soldOut = l === 0 || st === "sold_out" || (st === "ok" && m === 0 && inCart(s.date) === 0);
              const off = s.cancelled || s.closed || soldOut || st !== "ok" || !canBook || (m === 0 && inCart(s.date) > 0);
              const n = inCart(s.date);
              return (
                <div className="drow" key={s.date}>
                  <div>
                    <b>{dayLabel(s.date, today)}</b>
                    <span>
                      {timeRange(o)}
                      {s.cancelled
                        ? ", cancelled"
                        : s.closed
                          ? ", booking closed"
                          : soldOut
                            ? ", full"
                            : l !== null
                              ? `, ${l} ${l === 1 ? "spot" : "spots"} left`
                              : ""}
                      {n > 0 ? ` · ${n} in your cart` : ""}
                    </span>
                  </div>
                  <button
                    type="button"
                    className={`btn ${off ? "" : "primary"}`}
                    disabled={off || pending}
                    onClick={() => {
                      setQty(1);
                      setPicked(s.date);
                    }}
                  >
                    {s.cancelled ? "Cancelled" : s.closed ? "Closed" : soldOut ? "Full" : n > 0 ? "Add more" : "Select"}
                  </button>
                </div>
              );
            })
          ) : (
            <p className="muted" style={{ margin: 0 }}>No upcoming dates right now.</p>
          )}
        </section>
      )}

      {cart.lines.length > 0 && (
        <section className="panel">
          <h2>Your cart</h2>
          {cart.lines.map((l) => (
            <div className="tk" key={lineKey(l)}>
              <div>
                <b>
                  {l.qty} × {l.offeringTitle}
                </b>
                <span>
                  {dayLabel(l.date, today)}, {l.time} ·{" "}
                  <button type="button" className="linkish" onClick={() => cart.remove(lineKey(l))}>
                    Remove
                  </button>
                </span>
              </div>
              <div>{money(l.price * l.qty, l.currency)}</div>
            </div>
          ))}
          <div className="tk" style={{ borderTop: "1px solid var(--line)" }}>
            <div>
              <b>Total</b>
              <span>
                {meals} {meals === 1 ? "meal" : "meals"}
              </span>
            </div>
            <div>
              <b>{totalLabel ?? "Mixed currencies"}</b>
            </div>
          </div>
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              checkout(new FormData(e.currentTarget));
            }}
          >
            {!isMember && (
              <>
                <div className="fld">
                  <label htmlFor="m-name">Your name</label>
                  <input id="m-name" name="name" autoComplete="name" required />
                </div>
                <div className="fld">
                  <label htmlFor="m-email">Email</label>
                  <input id="m-email" name="email" type="email" autoComplete="email" required />
                  <span className="hint">We’ll email your passes here.</span>
                </div>
                <div className="fld">
                  <label htmlFor="m-phone">Phone (WhatsApp preferred)</label>
                  <input id="m-phone" name="phone" type="tel" autoComplete="tel" required />
                </div>
              </>
            )}
            <input name="ms_trap_x" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: "absolute", left: -9999 }} />
            <p className="note" style={{ marginTop: 0 }}>
              Meals are paid when you check out, in one payment. Your spots are held for 30 minutes, and a pass for
              each booking is issued once the payment goes through.
            </p>
            <div className="book-acts">
              <button type="submit" className="btn primary" disabled={pending || !canBook}>
                {pending ? "Booking…" : totalLabel ? `Check out · ${totalLabel}` : "Check out"}
              </button>
            </div>
          </form>
        </section>
      )}
    </>
  );
}
