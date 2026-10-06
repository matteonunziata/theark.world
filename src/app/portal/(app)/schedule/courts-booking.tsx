"use client";

import Link from "next/link";
import { useState } from "react";
import { useToast } from "@/components/toast";
import { BOOKING_DAYS, classAt, type Court, courtMoney, hhmm, PER_DAY, slots, SPORTS } from "@/lib/courts";
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
  courts: (Court & { price: number | null; currency: string })[];
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
        Court time is paid when you book{discount ? `, with your ${discount}% member discount` : ""}.
        {online ? " You’ll go to the card payment; the slot is held for 20 minutes while you pay." : " Settle at reception when you arrive."}{" "}
        Up to {PER_DAY} slots a day. For a two-hour booking or an open match, use the{" "}
        <Link href="/courts">public courts page</Link>.
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
                  {c.price ? ` · ${courtMoney(discount ? Number(c.price) * (1 - discount / 100) : Number(c.price), c.currency)}/slot` : ""}
                </span>
              </h2>
              {slots(c).map((s) => {
                const t = taken.find((x) => x.court_id === c.id && hhmm(x.start_time) < s.end && hhmm(x.end_time) > s.start);
                const cls = t ? null : classAt(c, s, classes);
                const gone = date === today && s.start <= now;
                const key = `${c.id}|${s.start}`;
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
                        onClick={() => run(key, () => bookCourt(c.id, date, s.start))}
                      >
                        {busy === key ? "Booking…" : "Book"}
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </section>
          ))}
        </div>
      )}
      {!isMember && (
        <p className="muted" style={{ marginTop: 16 }}>You’re signed in as staff. Members book courts from here; staff book them in Schedule → Courts of the staff app.</p>
      )}
    </>
  );
}
