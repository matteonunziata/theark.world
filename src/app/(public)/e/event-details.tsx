"use client";

import { kindName, money, priceLabel, whenLabel } from "@/lib/schedule";
import { BookingPanel } from "./[id]/[[...date]]/booking-panel";
import type { LoadedEvent } from "./load";

/** The event itself: what, when, photo, description, booking and tickets.
 * Used by the booking page and by the portal's booking modal. */
export function EventDetails({
  ev,
  date,
  isMember,
  compact,
  onBooked,
}: {
  ev: LoadedEvent;
  date: string | null;
  isMember: boolean;
  compact?: boolean;
  onBooked?: () => void;
}) {
  const { o, tickets } = ev;
  const booking = (
    <BookingPanel
      offering={{
        id: o.id,
        title: o.title,
        start_time: o.start_time,
        end_time: o.end_time,
        location: o.location,
        capacity: o.capacity,
      }}
      sessions={ev.sessions}
      counts={ev.counts}
      tickets={tickets}
      highlight={date}
      startOn={compact ? date : null}
      today={ev.today}
      isMember={isMember}
      canBook={ev.canBook}
      loginHref={`/portal/login?next=/e/${o.id}`}
      onBooked={onBooked}
    />
  );
  const ticketList = (
    <section className="panel">
      <h2>Tickets</h2>
      {tickets.length ? (
        tickets.map((t) => (
          <div className="tk" key={t.id}>
            <div>
              <b>{t.name}</b>
              {t.qty ? <span>{t.qty} per session</span> : null}
            </div>
            <div>{money(t.price, t.currency)}</div>
          </div>
        ))
      ) : (
        <p className="muted" style={{ margin: 0 }}>{priceLabel(o, [])}</p>
      )}
      {o.access === "members" && tickets.length ? (
        <p className="note" style={{ margin: "10px 0 0" }}>Members are included.</p>
      ) : null}
    </section>
  );

  return (
    <>
      {compact && ev.cover && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="ev-cover" src={ev.cover} alt="" />
      )}
      <span className={`kind ${o.kind !== "class" ? "event" : ""}`}>
        <i />
        {kindName(o.kind)}
        {o.access === "members" ? ", members only" : ""}
      </span>
      <h1 style={{ marginTop: 6 }}>{o.title}</h1>
      <p className="ev-meta">
        {whenLabel(o)}
        {o.location ? ` at ${o.location}` : ""}
        {ev.facilitator ? `, with ${ev.facilitator}` : ""}
      </p>
      {!compact && ev.cover && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="ev-cover" src={ev.cover} alt="" />
      )}
      {o.description && <p className="ev-desc">{o.description}</p>}
      {compact ? (
        <div style={{ display: "grid", gap: 14, marginTop: 18 }}>
          {booking}
          {tickets.length > 0 && ticketList}
        </div>
      ) : (
        <div className="ev-grid">
          {booking}
          <aside style={{ display: "grid", gap: 14 }}>{ticketList}</aside>
        </div>
      )}
    </>
  );
}
