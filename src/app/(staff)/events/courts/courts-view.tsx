"use client";

import Link from "next/link";
import { useState } from "react";
import { ConfirmButton, Drawer, useDrawer } from "@/components/drawer";
import type { Tables } from "@/lib/database.types";
import { addDays, fmtDate } from "@/lib/dates";
import { classAt, courtMoney, hhmm, levelRange, slots, SPORTS } from "@/lib/courts";
import type { Offering } from "@/lib/schedule";
import { saveCourt, saveCourtBooking } from "./actions";

type Court = Tables<"courts">;
type Booking = Tables<"court_bookings">;
type Person = { id: string; name: string; email: string | null; phone: string | null };
type Slot = { court: Court; start: string; end: string };

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

  return (
    <>
      <div className="toolbar">
        <span className="weeknav" style={{ margin: 0 }}>
          <Link className="btn sm" href={q(addDays(date, -1))} aria-label="Previous day">←</Link>
          <Link className="btn sm" href={q(today)}>Today</Link>
          <Link className="btn sm" href={q(addDays(date, 1))} aria-label="Next day">→</Link>
        </span>
        <b style={{ fontSize: 16 }}>{fmtDate(date, { weekday: "long", month: "long", day: "numeric" })}</b>
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
        <div className="courts" style={{ gridTemplateColumns: `repeat(${open.length}, minmax(200px, 1fr))` }}>
          {open.map((c) => (
            <section key={c.id} className="court-col">
              <h2>
                {c.name}
                <span className="muted">{SPORTS.find(([k]) => k === c.sport)?.[1]} · {hhmm(c.open_time)}–{hhmm(c.close_time)}</span>
              </h2>
              {slots(c).map((s) => {
                const b = bookings.find(
                  (x) => x.court_id === c.id && hhmm(x.start_time) < s.end && hhmm(x.end_time) > s.start,
                );
                const tags = b
                  ? [
                      b.status === "held" ? "paying now" : null,
                      b.open_match ? `open match, level ${levelRange(b.level_min, b.level_max)}` : b.players ? `${b.players} players` : null,
                      b.amount && Number(b.amount) > 0 ? (b.paid ? "paid" : `${courtMoney(Number(b.amount), b.currency)} unpaid`) : null,
                      b.source === "portal" ? "portal" : b.source === "web" ? "website" : null,
                    ].filter(Boolean)
                  : [];
                const cls = b ? null : classAt(c, s, classes);
                const gone = past(s.start);
                return b ? (
                  <button
                    key={s.start}
                    type="button"
                    className={`court-slot taken ${b.status === "held" ? "held" : ""}`}
                    onClick={() => book.openItem(b)}
                  >
                    <span className="t">{s.start}</span>
                    <span>
                      <b>{b.name}</b>
                      <span className="muted">{tags.join(" · ")}</span>
                    </span>
                  </button>
                ) : cls ? (
                  <div key={s.start} className="court-slot class">
                    <span className="t">{s.start}</span>
                    <span>{cls}</span>
                  </div>
                ) : (
                  <button
                    key={s.start}
                    type="button"
                    className="court-slot free"
                    disabled={gone}
                    onClick={() => {
                      setSlot({ court: c, ...s });
                      book.openNew();
                    }}
                  >
                    <span className="t">{s.start}</span>
                    <span className="muted">{gone ? "—" : "Free · book"}</span>
                  </button>
                );
              })}
            </section>
          ))}
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
  people,
}: {
  open: boolean;
  onClose: () => void;
  booking: Booking | null;
  slot: Slot | null;
  date: string;
  court?: Court;
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
  const start = b ? hhmm(b.start_time) : slot?.start;
  const end = b ? hhmm(b.end_time) : slot?.end;

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
      <p className="muted" style={{ marginTop: 0 }}>
        {court?.name ?? "Court"}, {fmtDate(b?.date ?? date, { weekday: "long", month: "long", day: "numeric" })}, {start}–{end}
      </p>
      {b && <input type="hidden" name="id" value={b.id} />}
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
                {courtMoney(x.price, x.currency)}
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
              <label htmlFor="ct-price">Price per slot</label>
              <input id="ct-price" name="price" type="number" min={0} step="any" defaultValue={c?.price ?? ""} />
            </div>
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
            <span className="hint">Members pay the price less their tier’s discount. Shown on /courts.</span>
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
