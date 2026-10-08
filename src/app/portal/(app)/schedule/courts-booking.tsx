"use client";

import Link from "next/link";
import { useState } from "react";
import { useToast } from "@/components/toast";
import {
  addMinutes,
  BOOKING_DAYS,
  classAt,
  type Court,
  courtMoney,
  courtPrice,
  durationLabel,
  durations,
  hhmm,
  LEVELS,
  overlapsTime,
  PER_DAY,
  share,
  slots,
  SPORTS,
} from "@/lib/courts";
import { addDays, DOW, fmtDate } from "@/lib/dates";
import type { Offering } from "@/lib/schedule";
import { bookCourt, cancelCourt } from "../../actions";

type Taken = { id: string; court_id: string; start_time: string; end_time: string; mine: boolean };
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

type PortalCourt = Court & {
  price: number | null;
  price_90: number | null;
  price_120: number | null;
  currency: string;
  max_players: number;
};
type Pick = { court: PortalCourt; start: string };

export function CourtsBooking({
  courts,
  taken,
  classes,
  mine,
  date,
  today,
  now,
  isMember,
  online,
  discount,
}: {
  courts: PortalCourt[];
  taken: Taken[];
  classes: Offering[];
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
  const days = Array.from({ length: BOOKING_DAYS + 1 }, (_, i) => addDays(today, i));
  const mineToday = taken.filter((t) => t.mine).length;

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

      <div className="sch-strip crt-days">
        {days.map((d) => (
          <Link key={d} href={`/portal/schedule?tab=courts&date=${d}`} aria-current={d === date ? "page" : undefined} className={d === today ? "today" : ""}>
            <span>{DOW[new Date(`${d}T00:00:00Z`).getUTCDay()]}</span>
            <b>{Number(d.slice(8))}</b>
          </Link>
        ))}
      </div>

      {!courts.length ? (
        <div className="pv-empty">
          <h3>No courts to book yet</h3>
          <p>Ask the team at reception.</p>
        </div>
      ) : (
        <div className="crt-grid">
          {courts.map((c) => (
            <section key={c.id} className="crt-court">
              <h2>
                {c.name}
                <span>
                  {SPORTS.find(([k]) => k === c.sport)?.[1]}
                  {c.price ? ` · ${courtMoney(courtPrice(c, c.slot_minutes) * (1 - discount / 100), c.currency)}/slot` : ""}
                </span>
              </h2>
              {slots(c).map((s) => {
                const t = taken.find((x) => x.court_id === c.id && hhmm(x.start_time) < s.end && hhmm(x.end_time) > s.start);
                const cls = t ? null : classAt(c, s, classes);
                const gone = date === today && s.start <= now;
                const full = mineToday >= PER_DAY;
                return (
                  <div key={s.start} className={`crt-slot ${t?.mine ? "mine" : t ? "taken" : cls ? "class" : gone ? "gone" : "free"}`}>
                    <span className="t">{s.start}</span>
                    <span className="what">
                      {t?.mine ? "Yours" : t ? "Taken" : cls ? cls : gone ? "Passed" : "Free"}
                    </span>
                    {t?.mine ? (
                      <button
                        type="button"
                        className="pv-btn ghost sm"
                        disabled={busy === t.id}
                        onClick={() => confirm("Cancel this booking?") && run(t.id, () => cancelCourt(t.id))}
                      >
                        Cancel
                      </button>
                    ) : !t && !cls && !gone && isMember ? (
                      <button
                        type="button"
                        className="pv-btn sm"
                        disabled={!!busy || full}
                        title={full ? `You have ${PER_DAY} slots this day` : undefined}
                        onClick={() => setPick({ court: c, start: s.start })}
                      >
                        Book
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </section>
          ))}
        </div>
      )}
      {pick && (
        <BookDialog
          key={`${pick.court.id}|${pick.start}`}
          pick={pick}
          date={date}
          taken={taken}
          classes={classes}
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
  taken,
  classes,
  discount,
  online,
  busy,
  onClose,
  onBook,
}: {
  pick: Pick;
  date: string;
  taken: Taken[];
  classes: Offering[];
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
      !taken.some((t) => t.court_id === c.id && overlapsTime(win, { start: hhmm(t.start_time), end: hhmm(t.end_time) })) &&
      !classAt(c, win, classes)
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
