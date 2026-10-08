"use client";

import { useActionState, useState } from "react";
import type { ActionResult } from "@/lib/action-result";
import { addDays, addMonths, fmtDate, monthLabel } from "@/lib/dates";
import { monthGrid, nights } from "@/lib/estate";
import { money } from "@/lib/schedule";
import { requestStay } from "../actions";

export type Listing = {
  id: string;
  title: string;
  summary: string | null;
  zone: string | null;
  bedrooms: number | null;
  beds: number | null;
  bathrooms: number | null;
  max_guests: number | null;
  min_nights: number;
  nightly_rate: number | null;
  rate_currency: string;
  cleaning_fee: number | null;
  amenities: string[];
  house_rules: string | null;
  check_in_time: string;
  check_out_time: string;
  photos: { path: string; caption: string | null }[];
  fallback_photo: string | null;
  taken: [string, string][];
  today: string;
};

export function BookingCard({
  l,
  initial,
}: {
  l: Listing;
  initial: { checkIn: string; checkOut: string; guests: number };
}) {
  const [checkIn, setCheckIn] = useState(initial.checkIn >= l.today ? initial.checkIn : "");
  const [checkOut, setCheckOut] = useState(initial.checkOut);
  const [guests, setGuests] = useState(Math.min(initial.guests, l.max_guests ?? 20));
  const [month, setMonth] = useState((initial.checkIn || l.today).slice(0, 7));
  const [state, action, pending] = useActionState(requestStay, { ok: false } as ActionResult);

  const taken = (d: string) => l.taken.some(([a, b]) => a <= d && d < b);
  const n = checkIn && checkOut > checkIn ? nights(checkIn, checkOut) : 0;
  const clash = n > 0 && l.taken.some(([a, b]) => a < checkOut && checkIn < b);
  const short = n > 0 && n < l.min_nights;
  const rate = l.nightly_rate !== null ? Number(l.nightly_rate) : null;
  const total = rate !== null && n ? rate * n + Number(l.cleaning_fee ?? 0) : null;
  const ready = n > 0 && !clash && !short;

  const pick = (d: string) => {
    if (d < l.today || taken(d)) return;
    if (!checkIn || (checkIn && checkOut) || d <= checkIn) {
      setCheckIn(d);
      setCheckOut("");
    } else {
      setCheckOut(d);
    }
  };

  if (state.ok) {
    return (
      <aside className="stay-book done">
        <h2>Request sent</h2>
        <p>
          Thank you. We’ll check {fmtDate(checkIn, { month: "long", day: "numeric" })} to{" "}
          {fmtDate(checkOut, { month: "long", day: "numeric" })} with the home’s steward and write to you within a day.
          Nothing is charged until we confirm.
        </p>
      </aside>
    );
  }

  const grid = monthGrid(`${month}-01`);
  return (
    <aside className="stay-book">
      <p className="stay-rate">
        {rate !== null ? (
          <>
            <b>{money(rate, l.rate_currency)}</b> a night
          </>
        ) : (
          "Ask us for rates"
        )}
      </p>

      <div className="sb-cal">
        <div className="sb-cal-h">
          <button type="button" onClick={() => setMonth(addMonths(month, -1))} disabled={month <= l.today.slice(0, 7)} aria-label="Previous month">←</button>
          <b>{monthLabel(month)}</b>
          <button type="button" onClick={() => setMonth(addMonths(month, 1))} aria-label="Next month">→</button>
        </div>
        <div className="sb-cal-g">
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
            <span key={i} className="dow">{d}</span>
          ))}
          {grid.days.map((d) => {
            const out = d.slice(0, 7) !== month;
            const busy = taken(d);
            const inRange = checkIn && (checkOut ? d >= checkIn && d < checkOut : d === checkIn);
            return (
              <button
                key={d}
                type="button"
                className={["d", out ? "out" : "", d < l.today ? "past" : "", busy ? "busy" : "", inRange ? "on" : "", d === checkIn || d === checkOut ? "end" : ""].join(" ")}
                disabled={out || d < l.today || (busy && !(checkIn && !checkOut && d > checkIn))}
                onClick={() => pick(d)}
              >
                {Number(d.slice(8))}
              </button>
            );
          })}
        </div>
        <p className="sb-hint">{!checkIn ? "Choose your check-in day" : !checkOut ? "Now choose your check-out day" : " "}</p>
      </div>

      <form action={action}>
        <input type="hidden" name="lot_id" value={l.id} />
        <div className="sb-row">
          <label>
            <span>Check-in</span>
            <input type="date" name="check_in" required min={l.today} value={checkIn} onChange={(e) => { setCheckIn(e.target.value); setMonth(e.target.value.slice(0, 7) || month); }} />
          </label>
          <label>
            <span>Check-out</span>
            <input type="date" name="check_out" required min={checkIn ? addDays(checkIn, 1) : l.today} value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
          </label>
        </div>
        <label className="sb-full">
          <span>Guests</span>
          <select name="guests" value={guests} onChange={(e) => setGuests(Number(e.target.value))}>
            {Array.from({ length: l.max_guests ?? 10 }, (_, i) => i + 1).map((g) => (
              <option key={g} value={g}>{g} guest{g === 1 ? "" : "s"}</option>
            ))}
          </select>
        </label>

        {n > 0 && (
          <div className={`sb-sum ${clash || short ? "bad" : ""}`}>
            {clash ? (
              "Some of those nights are taken. Try other dates."
            ) : short ? (
              `This home has a ${l.min_nights}-night minimum.`
            ) : rate !== null ? (
              <>
                <span>{money(rate, l.rate_currency)} × {n} night{n === 1 ? "" : "s"}</span>
                <span>{money(rate * n, l.rate_currency)}</span>
                {l.cleaning_fee ? (
                  <>
                    <span>Cleaning</span>
                    <span>{money(l.cleaning_fee, l.rate_currency)}</span>
                  </>
                ) : null}
                <b>Total</b>
                <b>{money(total, l.rate_currency)}</b>
              </>
            ) : (
              `${n} night${n === 1 ? "" : "s"}`
            )}
          </div>
        )}

        <div className="sb-who">
          <label className="sb-full">
            <span>Your name</span>
            <input name="name" required autoComplete="name" />
          </label>
          <div className="sb-row">
            <label>
              <span>Email</span>
              <input name="email" type="email" required autoComplete="email" />
            </label>
            <label>
              <span>Phone or WhatsApp</span>
              <input name="phone" type="tel" autoComplete="tel" />
            </label>
          </div>
          <label className="sb-full">
            <span>Anything we should know</span>
            <textarea name="message" rows={3} placeholder="Who’s coming, arrival time, questions" />
          </label>
          <input name="hp_contact" tabIndex={-1} autoComplete="off" className="sb-hp" aria-hidden="true" />
        </div>
        {!state.ok && state.error && <p className="sb-err" role="alert">{state.error}</p>}
        <button type="submit" className="sb-btn" disabled={pending || !ready}>
          {pending ? "Sending…" : "Request to stay"}
        </button>
        <p className="sb-note">We confirm every stay by hand, usually within a day. Nothing is charged until then.</p>
      </form>
    </aside>
  );
}
