"use client";

import Link from "next/link";
import { useState } from "react";
import { Drawer, useDrawer } from "@/components/drawer";
import type { Tables } from "@/lib/database.types";
import { addDays, fmtDate } from "@/lib/dates";
import { classAt, courtMoney, durationLabel, hhmm, LEVELS, overlapsTime, slots, SPORTS } from "@/lib/courts";
import type { Offering } from "@/lib/schedule";
import { blockCourt, bookCourtForGuest, savePrices, saveCourt } from "./actions";
import { BookingDetail } from "./booking-detail";
import type { SBooking } from "./staff-types";

type Court = Tables<"courts">;
type Price = Tables<"court_prices">;
type Person = { id: string; name: string; email: string | null; phone: string | null };
type Slot = { court: Court; start: string; end: string };

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
};
const pad = (h: number) => String(h).padStart(2, "0");
/** "Ana Rodriguez" becomes "Ana R." */
const shortName = (n: string) => {
  const [first, ...rest] = n.trim().split(/\s+/);
  return rest.length ? `${first} ${rest[rest.length - 1][0]}.` : first;
};
const hourLabel = (h: number) => `${h % 12 || 12} ${h < 12 || h === 24 ? "AM" : "PM"}`;

export function CourtsView({
  courts,
  bookings,
  classes,
  people,
  prices,
  usdRate,
  vatPercent,
  date,
  today,
  now,
  canManage,
}: {
  courts: Court[];
  bookings: SBooking[];
  classes: Offering[];
  people: Person[];
  prices: Price[];
  usdRate: number;
  vatPercent: number;
  date: string;
  today: string;
  now: string;
  canManage: boolean;
}) {
  const book = useDrawer<null>();
  const manage = useDrawer<Court>();
  const block = useDrawer<null>();
  const [slot, setSlot] = useState<Slot | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const open = courts.filter((c) => c.active);
  const q = (d: string) => `/events/courts?date=${d}`;
  const past = (start: string) => date < today || (date === today && start <= now);
  const from = open.length ? Math.floor(Math.min(...open.map((c) => toMin(hhmm(c.open_time)))) / 60) : 0;
  const to = open.length ? Math.ceil(Math.max(...open.map((c) => toMin(hhmm(c.close_time)))) / 60) : 0;
  const hours = Array.from({ length: to - from }, (_, i) => from + i);
  const span = (to - from) * 60;
  const place = (start: string, end: string) => ({
    left: `${((toMin(start) - from * 60) / span) * 100}%`,
    width: `${((toMin(end) - toMin(start)) / span) * 100}%`,
  });
  const sel = bookings.find((b) => b.id === selected) ?? null;
  /** Half-hour cells still free (not past, not booked, not blocked): shown as "N h free". */
  const freeCells = (c: Court, mine: SBooking[], blocked: { start: string; end: string }[]) =>
    slots(c).filter(
      (sl) =>
        !past(sl.start) &&
        !mine.some((x) => overlapsTime(sl, { start: hhmm(x.start_time), end: hhmm(x.end_time) })) &&
        !blocked.some((x) => overlapsTime(sl, x)),
    ).length;
  const equipment = prices.filter((p) => p.kind === "equipment" && p.active);
  const real = bookings.filter((b) => b.kind === "booking");
  const owing = real.filter((b) => b.state === "red").length;

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
          {real.length} booking{real.length === 1 ? "" : "s"}
          {owing ? `, ${owing} with money owed` : ""}
        </span>
        <span style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            type="date"
            className="field-in"
            aria-label="Go to date"
            value={date}
            onChange={(e) => e.target.value && (window.location.href = q(e.target.value))}
          />
          {open.length > 0 && (
            <button type="button" className="btn" onClick={block.openNew}>Block for a class</button>
          )}
          {canManage && (
            <button type="button" className="btn" onClick={manage.openNew}>Courts &amp; prices</button>
          )}
        </span>
      </div>

      {!open.length ? (
        <div className="empty">
          <h2>No courts yet</h2>
          <p>Add the padel and pickleball courts, with their opening hours.</p>
          {canManage && <button type="button" className="btn primary" onClick={manage.openNew}>Add a court</button>}
        </div>
      ) : (
        <div className="ct-card">
          <ul className="ct-legend" style={{ borderTop: 0, borderBottom: "1px solid var(--line)" }}>
            <li><i className="free" />Available</li>
            <li><i className="pastc" />Past</li>
            <li><i className="match" />Open match (filled spots)</li>
            <li><i className="class" />Class</li>
            <li><i className="paid" />Booked, fully paid</li>
            <li><i className="owed" />Booked, money owed</li>
          </ul>
          <div className="ct-scroll" style={{ "--cols": hours.length } as React.CSSProperties}>
            <div className="ct-in">
              <div className="ct-row head">
                <div className="ct-name" />
                <div className="ct-hours">
                  {hours.map((h) => {
                    const isNow = date === today && toMin(now) >= h * 60 && toMin(now) < (h + 1) * 60;
                    return (
                      <span key={h} className={isNow ? "now" : undefined}>
                        {hourLabel(h)}
                        {isNow ? " · now" : ""}
                      </span>
                    );
                  })}
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
                      <small>
                        {SPORTS.find(([k]) => k === c.sport)?.[1]} · {freeCells(c, mine, blocked) / 2} h free
                      </small>
                    </div>
                    <div className="ct-track">
                      {toMin(o) > from * 60 && <span className="blk off" style={place(`${pad(from)}:00`, o)} />}
                      {toMin(cl) < to * 60 && <span className="blk off" style={place(cl, `${pad(to)}:00`)} />}
                      {blocked.map((x) => (
                        <span key={x.k.id} className="blk class" style={place(x.start, x.end)} title={x.k.title}>
                          <b>{x.k.title}</b>
                          <small>{x.start}–{x.end}</small>
                        </span>
                      ))}
                      {slots(c)
                        .filter((sl) => past(sl.start) && !mine.some((x) => overlapsTime(sl, { start: hhmm(x.start_time), end: hhmm(x.end_time) })))
                        .map((sl) => (
                          <span key={`p${sl.start}`} className="blk pastc" style={place(sl.start, sl.end)} />
                        ))}
                      {mine.map((b) => {
                        const inCount = b.players.filter((p) => p.status === "in" || p.status === "held").length;
                        if (b.kind === "class") {
                          return (
                            <button
                              key={b.id}
                              type="button"
                              className="blk class blockc"
                              style={place(hhmm(b.start_time), hhmm(b.end_time))}
                              title={`${b.name} (blocked for a class)`}
                              onClick={() => setSelected(b.id)}
                            >
                              <b>{b.name}</b>
                              <small>{hhmm(b.start_time)}–{hhmm(b.end_time)}</small>
                            </button>
                          );
                        }
                        const kindClass = b.open_match ? "match" : b.state === "green" ? "paid" : "owed";
                        const when = `${hhmm(b.start_time)}–${hhmm(b.end_time)}`;
                        const others = inCount - 1;
                        const who = `${shortName(b.name)}${others > 0 && !b.open_match ? ` + ${others}` : ""}`;
                        const status = b.open_match
                          ? `${inCount}/${b.spots}${b.owed > 0 ? " · owed" : ""}`
                          : b.status === "held"
                            ? "Paying now"
                            : b.started_at
                              ? "Playing"
                              : b.state === "green"
                                ? "Paid"
                                : "Owes";
                        return (
                          <button
                            key={b.id}
                            type="button"
                            className={`blk ${kindClass} ${b.status === "held" ? "held" : ""}`}
                            style={place(hhmm(b.start_time), hhmm(b.end_time))}
                            title={`${b.name}, ${when}, ${status}${b.owed > 0 ? `, ${courtMoney(b.owed, b.currency)} owed` : ""}`}
                            onClick={() => setSelected(b.id)}
                          >
                            <b>{b.open_match ? "Open match" : who}</b>
                            <small>
                              {when} · {status}
                            </small>
                          </button>
                        );
                      })}
                      {slots(c).map((s) => {
                        const sp = { start: s.start, end: s.end };
                        const taken =
                          mine.some((x) => overlapsTime(sp, { start: hhmm(x.start_time), end: hhmm(x.end_time) })) ||
                          blocked.some((x) => overlapsTime(sp, x));
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
        </div>
      )}
      <p className="note">
        Colors come from the payments, including equipment: green when everything is paid, red while money is owed.
        Anyone books and pays on the public page (<Link href="/courts" target="_blank">/courts</Link>) and members in
        the portal. Click a booking to check players in, add equipment, take payment and start the game.
      </p>

      <NewBookingDrawer
        key={`new-${slot?.court.id}-${slot?.start}-${book.open}`}
        open={book.open}
        onClose={book.close}
        slot={slot}
        date={date}
        people={people}
        prices={prices.filter((p) => p.kind === "court" && p.active)}
        sameCourtBookings={bookings}
      />
      <BlockDrawer key={`blk-${block.open}`} open={block.open} onClose={block.close} courts={open} date={date} />
      {sel && (
        <BookingDetail
          key={sel.id}
          booking={sel}
          court={courts.find((c) => c.id === sel.court_id)}
          date={date}
          equipment={equipment}
          usdRate={usdRate}
          onClose={() => setSelected(null)}
        />
      )}
      {canManage && <CourtsDrawer open={manage.open} onClose={manage.close} courts={courts} prices={prices} usdRate={usdRate} vatPercent={vatPercent} />}
    </>
  );
}

function NewBookingDrawer({
  open,
  onClose,
  slot,
  date,
  people,
  prices,
  sameCourtBookings,
}: {
  open: boolean;
  onClose: () => void;
  slot: Slot | null;
  date: string;
  people: Person[];
  prices: Price[];
  sameCourtBookings: SBooking[];
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [contactId, setContactId] = useState("");
  const [match, setMatch] = useState<"private" | "open">("private");
  const [minutes, setMinutes] = useState(60);
  const pickName = (v: string) => {
    setName(v);
    const p = people.find((x) => x.name === v);
    if (p) {
      setContactId(p.id);
      setEmail(p.email ?? "");
      setPhone(p.phone ?? "");
    } else setContactId("");
  };
  const end = slot ? `${pad(Math.floor((toMin(slot.start) + minutes) / 60))}:${pad((toMin(slot.start) + minutes) % 60)}` : "";
  const fits = (m: number) =>
    !!slot &&
    toMin(slot.start) + m <= toMin(hhmm(slot.court.close_time)) &&
    !sameCourtBookings.some(
      (b) =>
        b.court_id === slot.court.id &&
        overlapsTime({ start: slot.start, end: `${pad(Math.floor((toMin(slot.start) + m) / 60))}:${pad((toMin(slot.start) + m) % 60)}` }, { start: hhmm(b.start_time), end: hhmm(b.end_time) }),
    );
  const price = (m: number) => prices.find((p) => p.minutes === m)?.price;

  return (
    <Drawer
      title="Book a court"
      open={open}
      onClose={onClose}
      action={bookCourtForGuest}
      footer={
        <>
          <span className="spacer" />
          <button type="button" className="btn ghost" onClick={onClose}>Close</button>
          <button type="submit" className="btn primary" disabled={!fits(minutes)}>Book</button>
        </>
      }
    >
      <p className="muted" style={{ marginTop: 0 }}>
        {slot?.court.name ?? "Court"}, {fmtDate(date, { weekday: "long", month: "long", day: "numeric" })}, {slot?.start}–{end}
      </p>
      {slot && (
        <>
          <input type="hidden" name="court_id" value={slot.court.id} />
          <input type="hidden" name="date" value={date} />
          <input type="hidden" name="start_time" value={slot.start} />
        </>
      )}
      <input type="hidden" name="contact_id" value={contactId} />
      <div className="grid2">
        <div className="fld">
          <label htmlFor="cb-len">Length</label>
          <select id="cb-len" name="minutes" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
            {prices.map((p) => p.minutes as number).sort((a, b) => a - b).map((m) => (
              <option key={m} value={m} disabled={!fits(m)}>
                {durationLabel(m)}
                {price(m) !== undefined ? ` · ${courtMoney(Number(price(m)), "CRC")}` : ""}
                {fits(m) ? "" : " (not free)"}
              </option>
            ))}
          </select>
        </div>
        <div className="fld">
          <label htmlFor="cb-spots">Players</label>
          <select id="cb-spots" name="spots" defaultValue="4">
            <option value="4">4 · doubles</option>
            <option value="2">2 · singles</option>
          </select>
        </div>
      </div>
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
      <span className="hint">Every player needs a name, phone and email before the game can start. You can fill them in at check-in.</span>
      <div className="grid2" style={{ marginTop: 12 }}>
        <div className="fld">
          <label htmlFor="cb-match">Kind of match</label>
          <select id="cb-match" name="match" value={match} onChange={(e) => setMatch(e.target.value as "private" | "open")}>
            <option value="private">Private</option>
            <option value="open">Open match (listed publicly)</option>
          </select>
        </div>
        {match === "private" ? (
          <div className="fld">
            <label htmlFor="cb-pay">Who pays</label>
            <select id="cb-pay" name="private_pay" defaultValue="split">
              <option value="split">Split between players</option>
              <option value="whole">Booker pays the whole court</option>
            </select>
          </div>
        ) : (
          <div className="fld">
            <label htmlFor="cb-level">Level</label>
            <select id="cb-level" name="level" defaultValue="2.5">
              {LEVELS.map(([v, n]) => (
                <option key={v} value={v}>{v} · {n}</option>
              ))}
            </select>
          </div>
        )}
      </div>
      <div className="fld">
        <label htmlFor="cb-notes">Notes</label>
        <textarea id="cb-notes" name="notes" rows={2} />
      </div>
    </Drawer>
  );
}

function BlockDrawer({
  open,
  onClose,
  courts,
  date,
}: {
  open: boolean;
  onClose: () => void;
  courts: Court[];
  date: string;
}) {
  return (
    <Drawer
      title="Block a court for a class"
      open={open}
      onClose={onClose}
      action={blockCourt}
      footer={
        <>
          <span className="spacer" />
          <button type="button" className="btn ghost" onClick={onClose}>Close</button>
          <button type="submit" className="btn primary">Block</button>
        </>
      }
    >
      <p className="muted" style={{ marginTop: 0 }}>
        The court can’t be booked by the public during this time. Click the blocked area on the schedule to release it.
      </p>
      <div className="grid2">
        <div className="fld">
          <label htmlFor="bk-court">Court</label>
          <select id="bk-court" name="court_id">
            {courts.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="fld">
          <label htmlFor="bk-date">Day</label>
          <input id="bk-date" name="date" type="date" defaultValue={date} required />
        </div>
      </div>
      <div className="grid2">
        <div className="fld">
          <label htmlFor="bk-start">From</label>
          <input id="bk-start" name="start_time" type="time" step={1800} defaultValue="09:00" required />
        </div>
        <div className="fld">
          <label htmlFor="bk-end">To</label>
          <input id="bk-end" name="end_time" type="time" step={1800} defaultValue="10:00" required />
        </div>
      </div>
      <div className="fld">
        <label htmlFor="bk-title">Class</label>
        <input id="bk-title" name="title" placeholder="e.g. Kids padel" />
      </div>
    </Drawer>
  );
}

function CourtsDrawer({
  open,
  onClose,
  courts,
  prices,
  usdRate,
  vatPercent,
}: {
  open: boolean;
  onClose: () => void;
  courts: Court[];
  prices: Price[];
  usdRate: number;
  vatPercent: number;
}) {
  const [editing, setEditing] = useState<Court | "new" | "prices" | null>(null);
  const c = editing && editing !== "new" && editing !== "prices" ? editing : null;
  const title = editing === "prices" ? "Prices" : editing ? (c ? `Edit ${c.name}` : "Add a court") : "Courts & prices";
  return (
    <Drawer
      title={title}
      open={open}
      onClose={() => {
        setEditing(null);
        onClose();
      }}
      action={async (prev, data) => {
        const r = editing === "prices" ? await savePrices(prev, data) : await saveCourt(prev, data);
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
            <button type="button" className="btn" onClick={() => setEditing("prices")}>Prices</button>
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
                {SPORTS.find(([k]) => k === x.sport)?.[1]} · {hhmm(x.open_time)}–{hhmm(x.close_time)} · half-hour blocks
              </span>
            </button>
          ))}
          {!courts.length && <div className="row static"><span className="muted">No courts yet.</span></div>}
          <p className="hint" style={{ marginTop: 12 }}>
            Prices are the same for every court and live under Prices: court time by length, equipment, the dollar rate and VAT.
          </p>
        </div>
      ) : editing === "prices" ? (
        <div>
          <p className="muted" style={{ marginTop: 0 }}>All prices are in colones and already include VAT. Old bookings keep the price they were made at.</p>
          <h3 className="hint">Court time</h3>
          {prices
            .filter((p) => p.kind === "court")
            .map((p) => (
              <div key={p.key} className="grid2" style={{ gridTemplateColumns: "1fr 1fr auto" }}>
                <div className="fld">
                  <label htmlFor={`pr-${p.key}`}>{p.label}</label>
                  <input id={`pr-${p.key}`} name={`price_${p.key}`} type="number" min={0} step="any" defaultValue={Number(p.price)} />
                </div>
                <span />
                <label className="check" style={{ alignSelf: "end", minHeight: 42 }}>
                  <input type="checkbox" name={`active_${p.key}`} defaultChecked={p.active} />
                  Offered
                </label>
              </div>
            ))}
          <h3 className="hint">Equipment</h3>
          {prices
            .filter((p) => p.kind === "equipment")
            .map((p) => (
              <div key={p.key} className="grid2" style={{ gridTemplateColumns: "1fr 1fr auto" }}>
                <div className="fld">
                  <label htmlFor={`pr-${p.key}`}>{p.label}</label>
                  <input id={`pr-${p.key}`} name={`price_${p.key}`} type="number" min={0} step="any" defaultValue={Number(p.price)} />
                </div>
                <span />
                <label className="check" style={{ alignSelf: "end", minHeight: 42 }}>
                  <input type="checkbox" name={`active_${p.key}`} defaultChecked={p.active} />
                  Offered
                </label>
              </div>
            ))}
          <h3 className="hint">Cash and VAT</h3>
          <div className="grid2">
            <div className="fld">
              <label htmlFor="pr-usd">Colones per US dollar</label>
              <input id="pr-usd" name="usd_crc_rate" type="number" min={1} step="any" defaultValue={usdRate} />
            </div>
            <div className="fld">
              <label htmlFor="pr-vat">VAT included (%)</label>
              <input id="pr-vat" name="vat_percent" type="number" min={0} max={99} step="any" defaultValue={vatPercent} />
            </div>
          </div>
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
          <div className="grid2">
            <div className="fld">
              <label htmlFor="ct-open">Opens</label>
              <input id="ct-open" name="open_time" type="time" step={1800} defaultValue={c ? hhmm(c.open_time) : "08:00"} />
            </div>
            <div className="fld">
              <label htmlFor="ct-close">Closes</label>
              <input id="ct-close" name="close_time" type="time" step={1800} defaultValue={c ? hhmm(c.close_time) : "20:00"} />
            </div>
          </div>
          <div className="fld">
            <label htmlFor="ct-desc">On the public page</label>
            <input id="ct-desc" name="description" defaultValue={c?.description ?? ""} placeholder="Glass court, lights" />
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
