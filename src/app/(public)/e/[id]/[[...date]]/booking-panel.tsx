"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { Tables } from "@/lib/database.types";
import { dayLabel, timeRange } from "@/lib/dates";
import { money } from "@/lib/schedule";
import { type BookingResult, bookSession } from "../../actions";

type Ticket = Tables<"ticket_types">;
type Count = { session_date: string; ticket_type_id: string | null; taken: number };

export function BookingPanel({
  offering: o,
  sessions,
  counts,
  tickets,
  highlight,
  today,
  isMember,
  canBook,
  loginHref,
}: {
  offering: {
    id: string;
    title: string;
    start_time: string | null;
    end_time: string | null;
    location: string | null;
    capacity: number | null;
  };
  sessions: { date: string; cancelled: boolean }[];
  counts: Count[];
  tickets: Ticket[];
  highlight: string | null;
  today: string;
  isMember: boolean;
  canBook: boolean;
  loginHref: string;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const [result, setResult] = useState<BookingResult | null>(null);
  const [pending, start] = useTransition();

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
              : "Keep your ticket handy. Show it at the gate."}
          </p>
          <p>
            <Link className="btn" href={`/t/${result.token}`}>
              View your ticket
            </Link>
          </p>
          {result.price &&
            (result.paymentLink ? (
              <a className="btn primary" href={result.paymentLink} target="_blank" rel="noopener noreferrer">
                Pay {result.price}
              </a>
            ) : (
              <p className="muted">Pay {result.price} at the front desk when you arrive.</p>
            ))}
        </div>
      </section>
    );
  }

  if (picked) {
    const firstOpen = tickets.find((t) => ticketLeft(t, picked) !== 0);
    return (
      <section className="panel">
        <h2>Book {o.title}</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          {dayLabel(picked, today)}, {timeRange(o)}
          {o.location ? ` at ${o.location}` : ""}
        </p>
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
              setResult(
                await bookSession({
                  offeringId: o.id,
                  date: picked,
                  name: String(fd.get("name") ?? ""),
                  email: String(fd.get("email") ?? ""),
                  ticketTypeId: (fd.get("ticket") as string) || null,
                  website: String(fd.get("website") ?? ""),
                }),
              );
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
          <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: "absolute", left: -9999 }} />
          {tickets.length > 0 && (
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
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" className="btn ghost" onClick={() => setPicked(null)}>
              Back
            </button>
            <button type="submit" className="btn primary" disabled={pending}>
              {pending ? "Booking…" : "Confirm booking"}
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
          const off = s.cancelled || l === 0 || !canBook;
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
                    : l === 0
                      ? ", full"
                      : l !== null
                        ? `, ${l} ${l === 1 ? "spot" : "spots"} left`
                        : ""}
                </span>
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
                {s.cancelled ? "Cancelled" : l === 0 ? "Full" : "Book"}
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
