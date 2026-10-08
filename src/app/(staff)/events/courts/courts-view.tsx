"use client";

import Link from "next/link";
import { useState } from "react";
import { ConfirmButton, Drawer, useDrawer } from "@/components/drawer";
import type { Tables } from "@/lib/database.types";
import { addDays, fmtDate } from "@/lib/dates";
import { classAt, courtMoney, hhmm, levelRange, overlapsTime, slots, SPORTS } from "@/lib/courts";
import type { Offering } from "@/lib/schedule";
import { saveCourt, saveCourtBooking } from "./actions";

type Court = Tables<"courts">;
type Booking = Tables<"court_bookings">;
type Person = { id: string; name: string; email: string | null; phone: string | null };
type Slot = { court: Court; start: string; end: string };

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
};
const pad = (h: number) => String(h).padStart(2, "0");
const hourLabel = (h: number) => `${h % 12 || 12} ${h < 12 || h === 24 ? "AM" : "PM"}`;

export function CourtsView({
  courts,
  bookings,
  classes,
  people,
  date,
  today,
  now,
  canManage,
}: {
  courts: Court[];
  bookings: Booking[];
  classes: Offering[];
  people: Person[];
  date: string;
  today: string;
  now: string;
  canManage: boolean;
}) {
  const book = useDrawer<Booking>();
  const manage = useDrawer<Court>();
  const [slot, setSlot] = useState<Slot | null>(null);
  const open = courts.filter((c) => c.active);
  const q = (d: string) => `/events/courts?date=${d}`;
  const past = (start: string) => date < today || (date === today && start <= now);
  const courtOf = (id: string) => courts.find((c) => c.id === id);
  const from = open.length ? Math.floor(Math.min(...open.map((c) => toMin(hhmm(c.open_time)))) / 60) : 0;
  const to = open.length ? Math.ceil(Math.max(...open.map((c) => toMin(hhmm(c.close_time)))) / 60) : 0;
  const hours = Array.from({ length: to - from }, (_, i) => from + i);
  const span = (to - from) * 60;
  const place = (start: string, end: string) => ({
    left: `${((toMin(start) - from * 60) / span) * 100}%`,
    width: `${((toMin(end) - toMin(start)) / span) * 100}%`,
  });

  return (
    <>
      <div className="toolbar">
        <span className="weeknav" style={{ margin: 0 }}>
          <Link className="btn sm" href={q(addDays(date, -1))} aria-label="Previous day">←</Link>
          <Link className="btn sm" href={q(today)}>Today</Link>
          <Link className="btn sm" href={q(addDays(date, 1))} aria-label="Next day">→</Link>
        </span>
        <span className="ct-day">
          <b>{date === today ? "Today" : fmtDate(date, { weekday: "long" })}</b>
          <span>{fmtDate(date, { weekday: "long", month: "long", day: "numeric" })}</span>
        </span>
        <span className="muted" style={{ fontSize: 13.5 }}>
          {bookings.length} booking{bookings.length === 1 ? "" : "s"}
        </span>
        <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <input
            type="date"
            className="field-in"
            aria-label="Go to date"
            value={date}
            onChange={(e) => e.target.value && (window.location.href = q(e.target.value))}
          />
          {canManage && (
            <button type="button" className="btn" onClick={manage.openNew}>Manage courts</button>
          )}
        </span>
      </div>

      {!open.length ? (
        <div className="empty">
          <h2>No courts yet</h2>
          <p>Add the padel and pickleball courts, with their opening hours and slot length.</p>
          {canManage && <button type="button" className="btn primary" onClick={manage.openNew}>Add a court</button>}
        </div>
      ) : (
        <div className="ct-card">
          <div className="ct-scroll" style={{ "--cols": hours.length } as React.CSSProperties}>
            <div className="ct-in">
              <div className="ct-row head">
                <div className="ct-name" />
                <div className="ct-hours">
                  {hours.map((h) => (
                    <span key={h}>{hourLabel(h)}</span>
                  ))}
                </div>
              </div>
              {open.map((c) => {
                const mine = bookings.filter((x) => x.court_id === c.id);
                const o = hhmm(c.open_time);
                const cl = hhmm(c.close_time);
                const blocked = classes
                  .map((k) => ({ k, start: hhmm(k.start_time ?? ""), end: hhmm(k.end_time ?? "") }))
                  .filter((x) => x.start && x.end && classAt(c, x, [x.k]));
                return (
                  <div key={c.id} className="ct-row">
                    <div className="ct-name">
                      {c.name}
                      <small>{SPORTS.find(([k]) => k === c.sport)?.[1]}</small>
                    </div>
                    <div className="ct-track">
                      {toMin(o) > from * 60 && <span className="blk off" style={place(`${pad(from)}:00`, o)} />}
                      {toMin(cl) < to * 60 && <span className="blk off" style={place(cl, `${pad(to)}:00`)} />}
                      {blocked.map((x) => (
                        <span key={x.k.id} className="blk class" style={place(x.start, x.end)} title={x.k.title}>
                          {x.k.title}
                        </span>
                      ))}
                      {mine.map((b) => {
                        const tags = [
                          b.status === "held" ? "paying now" : null,
                          b.open_match ? `open match, level ${levelRange(b.level_min, b.level_max)}` : b.players ? `${b.players} players` : null,
                          b.amount && Number(b.amount) > 0 ? (b.paid ? "paid" : `${courtMoney(Number(b.amount), b.currency)} unpaid`) : null,
                          b.source === "portal" ? "portal" : b.source === "web" ? "website" : null,
                        ].filter(Boolean);
                        return (
                          <button
                            key={b.id}
                            type="button"
                            className={`blk ${b.open_match ? "match" : "taken"} ${b.status === "held" ? "held" : ""}`}
                            style={place(hhmm(b.start_time), hhmm(b.end_time))}
                            title={`${b.name}, ${hhmm(b.start_time)}–${hhmm(b.end_time)}${tags.length ? `, ${tags.join(", ")}` : ""}`}
                            onClick={() => book.openItem(b)}
                          >
                            <b>{b.name}</b>
                            <small>{b.open_match ? "Open match" : b.paid ? "Paid" : b.status === "held" ? "Paying" : "Booked"}</small>
                          </button>
                        );
                      })}
                      {slots(c).map((s) => {
                        const span = { start: s.start, end: s.end };
                        const taken =
                          mine.some((x) => overlapsTime(span, { start: hhmm(x.start_time), end: hhmm(x.end_time) })) ||
                          blocked.some((x) => overlapsTime(span, x));
                        if (taken) return null;
                        const gone = past(s.start);
                        return (
                          <button
                            key={s.start}
                            type="button"
                            className="blk free"
                            style={place(s.start, s.end)}
                            disabled={gone}
                            aria-label={`${c.name}, ${s.start}`}
                            onClick={() => {
                              setSlot({ court: c, ...s });
                              book.openNew();
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <ul className="ct-legend">
            <li><i className="free" />Available</li>
            <li><i className="taken" />Booked</li>
            <li><i className="match" />Open match</li>
            <li><i className="class" />Class</li>
          </ul>
        </div>
      )}
      <p className="note">
        Anyone books and pays on the public page (<Link href="/courts" target="_blank">/courts</Link>), members in the portal
        with their discount, up to two weeks ahead and two slots a day. A slot being paid for is held for 20 minutes.
        Classes held at the courts block them.
      </p>

      <BookingDrawer
        key={book.item?.id ?? `new-${slot?.court.id}-${slot?.start}-${book.open}`}
        open={book.open}
        onClose={book.close}
        booking={book.item}
        slot={slot}
        date={date}
        court={book.item ? courtOf(book.item.court_id) : slot?.court}
        courts={courts.filter((c) => c.active)}
        people={people}
      />
      {canManage && (
        <CourtsDrawer open={manage.open} onClose={manage.close} courts={courts} />
      )}
    </>
  );
}

function BookingDrawer({
  open,
  onClose,
  booking: b,
  slot,
  date,
  court,
  courts,
  people,
}: {
  open: boolean;
  onClose: () => void;
  booking: Booking | null;
  slot: Slot | null;
  date: string;
  court?: Court;
  courts: Court[];
  people: Person[];
}) {
  const [name, setName] = useState(b?.name ?? "");
  const [email, setEmail] = useState(b?.email ?? "");
  const [phone, setPhone] = useState(b?.phone ?? "");
  const [contactId, setContactId] = useState(b?.contact_id ?? "");
  const pickName = (v: string) => {
    setName(v);
    const p = people.find((x) => x.name === v);
    if (p) {
      setContactId(p.id);
      setEmail(p.email ?? "");
      setPhone(p.phone ?? "");
    } else setContactId("");
  };
  const [courtId, setCourtId] = useState(b?.court_id ?? "");
  const [when, setWhen] = useState(b?.date ?? date);
  const [from, setFrom] = useState(b ? hhmm(b.start_time) : "");
  const [to, setTo] = useState(b ? hhmm(b.end_time) : "");
  const start = b ? from : slot?.start;
  const end = b ? to : slot?.end;

  return (
    <Drawer
      title={b ? "Court booking" : "Book a court"}
      open={open}
      onClose={onClose}
      action={saveCourtBooking}
      footer={
        <>
          {b && <ConfirmButton label="Cancel booking" />}
          <span className="spacer" />
          <button type="button" className="btn ghost" onClick={onClose}>Close</button>
          <button type="submit" className="btn primary">{b ? "Save" : "Book"}</button>
        </>
      }
    >
      {!b && (
        <p className="muted" style={{ marginTop: 0 }}>
          {court?.name ?? "Court"}, {fmtDate(date, { weekday: "long", month: "long", day: "numeric" })}, {start}–{end}
        </p>
      )}
      {b && <input type="hidden" name="id" value={b.id} />}
      {b && (
        <>
          <div className="grid2">
            <div className="fld">
              <label htmlFor="cb-court">Court</label>
              <select id="cb-court" name="court_id" value={courtId} onChange={(e) => setCourtId(e.target.value)}>
                {courts.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
                {!courts.some((c) => c.id === b.court_id) && court && <option value={court.id}>{court.name}</option>}
              </select>
            </div>
            <div className="fld">
              <label htmlFor="cb-date">Date</label>
              <input id="cb-date" name="date" type="date" required value={when} onChange={(e) => setWhen(e.target.value)} />
            </div>
          </div>
          <div className="grid2">
            <div className="fld">
              <label htmlFor="cb-from">Starts</label>
              <input id="cb-from" name="start_time" type="time" step={900} required value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="fld">
              <label htmlFor="cb-to">Ends</label>
              <input id="cb-to" name="end_time" type="time" step={900} required value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
        </>
      )}
      {!b && slot && (
        <>
          <input type="hidden" name="court_id" value={slot.court.id} />
          <input type="hidden" name="date" value={date} />
          <input type="hidden" name="start_time" value={slot.start} />
          <input type="hidden" name="end_time" value={slot.end} />
        </>
      )}
      <input type="hidden" name="contact_id" value={contactId} />
      <div className="fld">
        <label htmlFor="cb-name">Who is it for</label>
        <input
          id="cb-name"
          name="name"
          required
          list={people.length ? "cb-people" : undefined}
          value={name}
          onChange={(e) => pickName(e.target.value)}
          placeholder={people.length ? "Start typing a name from the CRM, or anyone" : "Name"}
          autoComplete="off"
        />
        {people.length > 0 && (
          <datalist id="cb-people">
            {people.map((p) => (
              <option key={p.id} value={p.name} />
            ))}
          </datalist>
        )}
        {contactId && <span className="hint">Linked to their CRM profile.</span>}
      </div>
      <div className="grid2">
        <div className="fld">
          <label htmlFor="cb-email">Email</label>
          <input id="cb-email" name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="fld">
          <label htmlFor="cb-phone">Phone</label>
          <input id="cb-phone" name="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
      </div>
      <div className="grid2">
        <div className="fld">
          <label htmlFor="cb-players">Players</label>
          <input id="cb-players" name="players" type="number" min={1} max={8} defaultValue={b?.players ?? ""} />
        </div>
        {b && (
          <div className="fld">
            <label htmlFor="cb-paid">Payment</label>
            <label className="check" style={{ minHeight: 42 }}>
              <input id="cb-paid" type="checkbox" name="paid" defaultChecked={b.paid} />
              Paid{b.amount && Number(b.amount) > 0 ? ` (${courtMoney(Number(b.amount), b.currency)})` : ""}
            </label>
            <span className="hint">
              {b.status === "held"
                ? "Being paid on Stripe right now."
                : b.open_match
                  ? `Open match, level ${levelRange(b.level_min, b.level_max)}, ${b.spots} players; each pays their share online.`
                  : b.paid
                    ? "Paid online or at reception."
                    : "Tick when settled at reception."}
            </span>
          </div>
        )}
      </div>
      <div className="fld">
        <label htmlFor="cb-notes">Notes</label>
        <textarea id="cb-notes" name="notes" rows={3} defaultValue={b?.notes ?? ""} placeholder="Rackets, balls, a coach" />
      </div>
    </Drawer>
  );
}

function CourtsDrawer({ open, onClose, courts }: { open: boolean; onClose: () => void; courts: Court[] }) {
  const [editing, setEditing] = useState<Court | "new" | null>(null);
  const c = editing && editing !== "new" ? editing : null;
  return (
    <Drawer
      title={editing ? (c ? `Edit ${c.name}` : "Add a court") : "Courts"}
      open={open}
      onClose={() => {
        setEditing(null);
        onClose();
      }}
      action={async (prev, data) => {
        const r = await saveCourt(prev, data);
        if (r.ok) setEditing(null);
        return r;
      }}
      footer={
        editing ? (
          <>
            <button type="button" className="btn ghost" onClick={() => setEditing(null)}>Back</button>
            <span className="spacer" />
            <button type="submit" className="btn primary">Save</button>
          </>
        ) : (
          <>
            <span className="spacer" />
            <button type="button" className="btn primary" onClick={() => setEditing("new")}>Add a court</button>
          </>
        )
      }
    >
      {!editing ? (
        <div className="list">
          {courts.map((x) => (
            <button key={x.id} type="button" className="row static court-row" style={{ cursor: "pointer" }} onClick={() => setEditing(x)}>
              <span>
                <b>{x.name}</b>
                {!x.active && <span className="ptype" style={{ marginLeft: 6 }}>Closed</span>}
              </span>
              <span className="muted">
                {SPORTS.find(([k]) => k === x.sport)?.[1]} · {hhmm(x.open_time)}–{hhmm(x.close_time)} · {x.slot_minutes} min ·{" "}
                {[x.price, x.price_90, x.price_120].map((p) => (p === null ? "—" : courtMoney(p, x.currency))).join(" / ")}
              </span>
            </button>
          ))}
          {!courts.length && <div className="row static"><span className="muted">No courts yet.</span></div>}
        </div>
      ) : (
        <div key={c?.id ?? "new"}>
          {c && <input type="hidden" name="id" value={c.id} />}
          <div className="grid2">
            <div className="fld">
              <label htmlFor="ct-name">Name</label>
              <input id="ct-name" name="name" required defaultValue={c?.name ?? ""} placeholder="e.g. Padel court 2" />
            </div>
            <div className="fld">
              <label htmlFor="ct-sport">Sport</label>
              <select id="ct-sport" name="sport" defaultValue={c?.sport ?? "padel"}>
                {SPORTS.map(([k, l]) => (
                  <option key={k} value={k}>{l}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid2" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
            <div className="fld">
              <label htmlFor="ct-open">Opens</label>
              <input id="ct-open" name="open_time" type="time" defaultValue={c ? hhmm(c.open_time) : "07:00"} />
            </div>
            <div className="fld">
              <label htmlFor="ct-close">Closes</label>
              <input id="ct-close" name="close_time" type="time" defaultValue={c ? hhmm(c.close_time) : "20:00"} />
            </div>
            <div className="fld">
              <label htmlFor="ct-slot">Slot (minutes)</label>
              <input id="ct-slot" name="slot_minutes" type="number" min={15} max={240} step={15} defaultValue={c?.slot_minutes ?? 60} />
            </div>
          </div>
          <div className="grid2" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
            <div className="fld">
              <label htmlFor="ct-price">1 hour</label>
              <input id="ct-price" name="price" type="number" min={0} step="any" defaultValue={c?.price ?? ""} />
            </div>
            <div className="fld">
              <label htmlFor="ct-p90">1½ hours</label>
              <input id="ct-p90" name="price_90" type="number" min={0} step="any" defaultValue={c?.price_90 ?? ""} />
            </div>
            <div className="fld">
              <label htmlFor="ct-p120">2 hours</label>
              <input id="ct-p120" name="price_120" type="number" min={0} step="any" defaultValue={c?.price_120 ?? ""} />
            </div>
          </div>
          <div className="grid2" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div className="fld">
              <label htmlFor="ct-currency">Currency</label>
              <select id="ct-currency" name="currency" defaultValue={c?.currency ?? "CRC"}>
                <option value="CRC">₡ colones</option>
                <option value="USD">$ dollars</option>
              </select>
            </div>
            <div className="fld">
              <label htmlFor="ct-max">Max players</label>
              <input id="ct-max" name="max_players" type="number" min={2} max={8} defaultValue={c?.max_players ?? 4} />
            </div>
          </div>
          <div className="fld">
            <label htmlFor="ct-desc">On the public page</label>
            <input id="ct-desc" name="description" defaultValue={c?.description ?? ""} placeholder="Glass court, lights, rackets at reception" />
            <span className="hint">
              Prices are per booking length; leave 1½ or 2 hours empty to scale the 1 hour price. Members get their tier’s discount.
            </span>
          </div>
          <label className="check">
            <input type="checkbox" name="active" defaultChecked={c?.active ?? true} />
            Open for bookings
          </label>
        </div>
      )}
    </Drawer>
  );
}
