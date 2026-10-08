"use client";

import Link from "next/link";
import { useState } from "react";
import { useToast } from "@/components/toast";
import { CourtGrid, type DayRow } from "@/app/(public)/courts/court-booker";
import "@/app/(public)/courts/courts.css";
import {
  addMinutes,
  BOOKING_DAYS,
  courtMoney,
  courtPrice,
  durationLabel,
  durations,
  hhmm,
  LEVELS,
  overlapsTime,
  PER_DAY,
  type PublicCourt,
  share,
} from "@/lib/courts";
import { addDays, fmtDate } from "@/lib/dates";
import { bookCourt, cancelCourt } from "../../actions";

type Mine = {
  id: string;
  court: string;
  date: string;
  start_time: string;
  end_time: string;
  token: string;
  player_token: string | null;
  amount: number | null;
  currency: string;
  paid: boolean;
  open_match: boolean;
};

type Pick = { court: PublicCourt; start: string };

export function CourtsBooking({
  courts,
  day,
  mine,
  date,
  today,
  now,
  isMember,
  online,
  discount,
}: {
  courts: PublicCourt[];
  day: DayRow[];
  mine: Mine[];
  date: string;
  today: string;
  now: string;
  isMember: boolean;
  /** Stripe is set up, so unpaid bookings get a Pay button. */
  online: boolean;
  /** The member's discount, in percent. */
  discount: number;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [pick, setPick] = useState<Pick | null>(null);
  const last = addDays(today, BOOKING_DAYS);
  const href = (d: string) => `/portal/schedule?tab=courts${d !== today ? `&date=${d}` : ""}`;

  const run = async (key: string, fn: () => Promise<{ ok: boolean; message?: string; error?: string; payUrl?: string }>) => {
    setBusy(key);
    const r = await fn();
    if (r.ok && r.payUrl) {
      // The slot is held; pay on Stripe to confirm it.
      window.location.assign(r.payUrl);
      return;
    }
    setBusy(null);
    toast(r.ok ? (r.message ?? "Done") : (r.error ?? "Something went wrong"));
  };

  return (
    <>
      <p className="crt-note">
        {discount ? `${discount}% member discount. ` : ""}
        {online ? "Pay by card to confirm; held 20 min." : "Pay at reception."} Up to {PER_DAY} bookings a day. Open match: others join and pay their share.
      </p>

      {mine.length > 0 && (
        <section className="crt-mine">
          <h2>Your bookings</h2>
          {mine.map((m) => (
            <div key={m.id} className="crt-mine-row">
              <span>
                <b>{m.court}</b>
                <span className="muted">
                  {" "}
                  · {m.date === today ? "Today" : fmtDate(m.date, { weekday: "short", month: "short", day: "numeric" })},{" "}
                  {hhmm(m.start_time)}–{hhmm(m.end_time)}
                  {m.open_match ? " · open match" : ""}
                  {m.amount && Number(m.amount) > 0 ? ` · ${courtMoney(Number(m.amount), m.currency)}${m.paid ? ", paid" : ""}` : ""}
                </span>
              </span>
              <span style={{ display: "flex", gap: 6 }}>
                {online && !m.paid && m.player_token && Number(m.amount) > 0 && (
                  <a className="pv-btn sm" href={`/pay/court/${m.player_token}`}>Pay</a>
                )}
                <Link className="pv-btn ghost sm" href={`/courts/b/${m.token}`}>Details</Link>
                <button
                  type="button"
                  className="pv-btn ghost sm"
                  disabled={busy === m.id}
                  onClick={() => confirm("Cancel this booking?") && run(m.id, () => cancelCourt(m.id))}
                >
                  Cancel
                </button>
              </span>
            </div>
          ))}
        </section>
      )}

      <div className="crts crts-embed">
        <div className="crts-sec-h">
          <div>
            <p className="eyebrow">Book</p>
            <h2>Available courts</h2>
          </div>
          {courts.length > 0 && (
            <div className="crts-date">
              <Link className="crts-step" href={href(addDays(date, -1))} aria-label="Previous day" aria-disabled={date <= today} tabIndex={date <= today ? -1 : undefined}>
                ‹
              </Link>
              <div className="label" aria-live="polite">
                <b>{date === today ? "Today" : fmtDate(date, { weekday: "long" })}</b>
                <span>{fmtDate(date, { month: "long", day: "numeric", ...(date === today ? { weekday: "long" } : {}) })}</span>
              </div>
              <Link className="crts-step" href={href(addDays(date, 1))} aria-label="Next day" aria-disabled={date >= last} tabIndex={date >= last ? -1 : undefined}>
                ›
              </Link>
            </div>
          )}
        </div>
        {!courts.length ? (
          <div className="crts-empty">
            <h3>No courts to book yet</h3>
            <p className="muted">Ask the team at reception.</p>
          </div>
        ) : (
          <>
            <div className="crts-card-cal">
              <CourtGrid
                courts={courts}
                day={day}
                date={date}
                today={today}
                now={now}
                onPick={(court, start) => (isMember ? setPick({ court, start }) : toast("Court booking is for members."))}
              />
            </div>
            <p className="crts-hint">Pick a free slot to book it, or a gold one to join an open match.</p>
          </>
        )}
      </div>
      {pick && (
        <BookDialog
          key={`${pick.court.id}|${pick.start}`}
          pick={pick}
          date={date}
          day={day}
          discount={discount}
          online={online}
          busy={!!busy}
          onClose={() => setPick(null)}
          onBook={(o) =>
            run("book", () => bookCourt({ courtId: pick.court.id, date, start: pick.start, ...o })).then(() => setPick(null))
          }
        />
      )}
      {!isMember && (
        <p className="muted" style={{ marginTop: 16 }}>You’re signed in as staff. Members book courts from here; staff book them in Schedule → Courts of the staff app.</p>
      )}
    </>
  );
}

function BookDialog({
  pick,
  date,
  day,
  discount,
  online,
  busy,
  onClose,
  onBook,
}: {
  pick: Pick;
  date: string;
  day: DayRow[];
  discount: number;
  online: boolean;
  busy: boolean;
  onClose: () => void;
  onBook: (o: { minutes: number; openMatch: boolean; level?: number; spots?: number; levelMin?: number; levelMax?: number }) => void;
}) {
  const c = pick.court;
  const fits = (m: number) => {
    const win = { start: pick.start, end: addMinutes(pick.start, m) };
    return (
      win.end <= hhmm(c.close_time) &&
      !day.some((t) => t.court_id === c.id && overlapsTime(win, { start: hhmm(t.start_time), end: hhmm(t.end_time) }))
    );
  };
  const lengths = durations(c).filter(fits);
  const [minutes, setMinutes] = useState(lengths[0] ?? c.slot_minutes);
  const [open, setOpen] = useState(false);
  const [level, setLevel] = useState(2.5);
  const [spots, setSpots] = useState(Math.min(4, c.max_players));
  const price = (m: number) => {
    const n = courtPrice(c, m) * (1 - discount / 100);
    return c.currency === "USD" ? Math.round(n * 100) / 100 : Math.round(n);
  };
  const total = price(minutes);
  const mine = open ? share(total, spots, c.currency) : total;

  return (
    <div className="crt-dlg" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="crt-dlg-in" role="dialog" aria-label={`${c.name}, ${pick.start}`}>
        <h2>{c.name}</h2>
        <p className="muted">
          {fmtDate(date, { weekday: "short", month: "short", day: "numeric" })} · {pick.start}
        </p>
        <div className="crt-lens">
          {durations(c).map((m) => (
            <button key={m} type="button" disabled={!lengths.includes(m)} className={m === minutes ? "on" : ""} onClick={() => setMinutes(m)}>
              <b>{durationLabel(m)}</b>
              <span>{lengths.includes(m) ? courtMoney(price(m), c.currency) : "Not free"}</span>
            </button>
          ))}
        </div>
        <label className="crt-open">
          <input type="checkbox" checked={open} onChange={(e) => setOpen(e.target.checked)} />
          <span>
            <b>Open match</b>
            <span>Others join and pay their share. You pay yours.</span>
          </span>
        </label>
        {open && (
          <div className="crt-two">
            <label>
              Your level
              <select className="pv-input" value={level} onChange={(e) => setLevel(Number(e.target.value))}>
                {LEVELS.map(([v, name]) => (
                  <option key={v} value={v}>
                    {v} · {name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Players
              <select className="pv-input" value={spots} onChange={(e) => setSpots(Number(e.target.value))}>
                {Array.from({ length: c.max_players - 1 }, (_, i) => i + 2).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
        <div className="crt-total">
          <span>
            {open ? "Your share" : "Total"}
            {discount ? <small> · {discount}% off</small> : null}
            {open ? <small> · court {courtMoney(total, c.currency)}</small> : null}
          </span>
          <b>{courtMoney(mine, c.currency)}</b>
        </div>
        <div className="crt-acts">
          <button type="button" className="pv-btn ghost" onClick={onClose}>Close</button>
          <button
            type="button"
            className="pv-btn"
            disabled={busy || !lengths.includes(minutes)}
            onClick={() =>
              onBook({
                minutes,
                openMatch: open,
                ...(open ? { level, spots, levelMin: Math.max(0, level - 1), levelMax: Math.min(7, level + 1) } : {}),
              })
            }
          >
            {busy ? "Booking…" : online && mine > 0 ? "Pay" : "Book"}
          </button>
        </div>
      </div>
    </div>
  );
}
