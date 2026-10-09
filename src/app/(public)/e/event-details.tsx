"use client";

import { fmtDate } from "@/lib/dates";
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
  const { o } = ev;
  const tickets = ev.tickets;
  // The booking form takes main tickets that are on sale (or sold out, so it can say so).
  const bookable = tickets.filter((t) => t.kind === "main" && ["ok", "sold_out"].includes(ev.states[t.id] ?? "ok"));
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
      attendees={ev.attendees}
      counts={ev.counts}
      tickets={bookable}
      highlight={date}
      startOn={compact ? date : null}
      today={ev.today}
      isMember={isMember}
      canBook={ev.canBook}
      loginHref={`/portal/login?next=/e/${o.id}`}
      onBooked={onBooked}
    />
  );
  const days = [...new Set(ev.schedule.map((x) => x.day))];
  const scheduleList = ev.schedule.length > 0 && (
    <section className="panel">
      <h2>Schedule</h2>
      {days.map((day) => (
        <div key={day}>
          {days.length > 1 && <p className="note" style={{ margin: "8px 0 0" }}>{fmtDate(day, { weekday: "long", month: "long", day: "numeric" })}</p>}
          {ev.schedule
            .filter((x) => x.day === day)
            .map((x) => (
              <div className="tk" key={x.id}>
                <div>
                  <b>{x.title}</b>
                  {x.location ? <span>{x.location}</span> : null}
                  {x.description ? <span>{x.description}</span> : null}
                </div>
                <div>
                  {x.start_time.slice(0, 5)}
                  {x.end_time ? `–${x.end_time.slice(0, 5)}` : ""}
                </div>
              </div>
            ))}
        </div>
      ))}
    </section>
  );
  const gallery = ev.images.length > 0 && (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10, marginTop: 14 }}>
      {ev.images.map((src) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={src} src={src} alt="" style={{ width: "100%", borderRadius: 12, display: "block" }} />
      ))}
    </div>
  );
  const ticketList = (
    <section className="panel">
      <h2>Tickets</h2>
      {tickets.length ? (
        tickets.map((t) => {
          const st = ev.states[t.id] ?? "ok";
          const note =
            st === "sold_out"
              ? "Sold out"
              : st === "not_started" && t.sales_start
                ? `On sale ${t.sales_start.slice(0, 10)} at ${t.sales_start.slice(11, 16)}`
                : st === "ended"
                  ? "Sales ended"
                  : st === "locked"
                    ? "Opens when the earlier tickets sell out"
                    : t.kind === "addon"
                      ? "Optional add-on"
                      : t.qty
                        ? `${t.qty} per session`
                        : null;
          return (
            <div className="tk" key={t.id} style={st === "ok" ? undefined : { opacity: 0.6 }}>
              <div>
                <b>{t.name}</b>
                {note ? <span>{note}</span> : null}
              </div>
              <div>{money(t.price, t.currency)}</div>
            </div>
          );
        })
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
      {gallery}
      {ev.registrationClosed && (
        <p className="note" role="status" style={{ marginTop: 14 }}><b>Registration closed.</b></p>
      )}
      {compact ? (
        <div style={{ display: "grid", gap: 14, marginTop: 18 }}>
          {booking}
          {tickets.length > 0 && ticketList}
          {scheduleList}
        </div>
      ) : (
        <div className="ev-grid">
          {booking}
          <aside style={{ display: "grid", gap: 14 }}>
            {ticketList}
            {scheduleList}
          </aside>
        </div>
      )}
    </>
  );
}
