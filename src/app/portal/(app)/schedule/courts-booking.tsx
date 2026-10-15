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
  durationLabel,
  lengthsOf,
  priceFor,
  type EquipmentPick,
  equipmentTotal,
  hhmm,
  LEVELS,
  MOVE_LIMIT,
  overlapsTime,
  PER_DAY,
  type PriceItem,
  type PublicCourt,
} from "@/lib/courts";
import { addDays, fmtDate } from "@/lib/dates";
import { freeStarts } from "@/app/(public)/courts/actions";
import { EquipmentPicker } from "@/app/(public)/courts/equipment-picker";
import { MoveForm } from "@/app/(public)/courts/move-form";
import { bookCourt, cancelCourt, moveMyCourt } from "../../actions";

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
  court_id: string;
  minutes: number;
  share_token: string;
  private_pay: string | null;
  spots: number;
  movable: boolean;
  due: number;
};

type Pick = { court: PublicCourt; start: string };

export function CourtsBooking({
  courts,
  day,
  prices,
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
  prices: PriceItem[];
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
  const [moving, setMoving] = useState<string | null>(null);
  const last = addDays(today, BOOKING_DAYS);
  const courtPrices = Object.fromEntries(prices.filter((p) => p.kind === "court").map((p) => [p.minutes as number, Number(p.price)]));
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
        {online ? "Pay by card to confirm; held 20 min." : "Pay at reception."} Up to {PER_DAY} bookings a day. Open match: listed for anyone to join. Private match: friends join with your link.
      </p>

      {mine.length > 0 && (
        <section className="crt-mine">
          <h2>Your bookings</h2>
          {mine.map((m) => (
            <div key={m.id}>
              <div className="crt-mine-row">
                <span>
                  <b>{m.court}</b>
                  <span className="muted">
                    {" "}
                    · {m.date === today ? "Today" : fmtDate(m.date, { weekday: "short", month: "short", day: "numeric" })},{" "}
                    {hhmm(m.start_time)}–{hhmm(m.end_time)}
                    {m.open_match ? " · open match" : m.private_pay === "whole" ? " · private, you pay all" : " · private, split"}
                    {Number(m.due) > 0 ? ` · ${courtMoney(Number(m.due), m.currency)} to pay` : " · paid"}
                  </span>
                </span>
                <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {online && Number(m.due) > 0 && m.player_token && (
                    <a className="pv-btn sm" href={`/pay/court/${m.player_token}`}>Pay</a>
                  )}
                  <button
                    type="button"
                    className="pv-btn ghost sm"
                    onClick={async () => {
                      const url = `${window.location.origin}/courts/join/${m.share_token}`;
                      try {
                        await navigator.clipboard.writeText(url);
                        toast("Join link copied. Send it to your friends.");
                      } catch {
                        window.prompt("Copy this link", url);
                      }
                    }}
                  >
                    Join link
                  </button>
                  {m.movable && (
                    <button type="button" className="pv-btn ghost sm" onClick={() => setMoving(moving === m.id ? null : m.id)}>
                      Move
                    </button>
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
              {moving === m.id && (
                <div className="crts" style={{ padding: "8px 0 14px" }}>
                  <MoveForm
                    current={{ date: m.date, start: hhmm(m.start_time), minutes: m.minutes }}
                    today={today}
                    last={last}
                    prices={courtPrices}
                    movesLeft={MOVE_LIMIT}
                    loadStarts={(d, mins) => freeStarts(m.court_id, d, mins, m.id)}
                    onMove={async (d, st, mins) => {
                      const r = await moveMyCourt(m.id, d, st, mins);
                      if (r.ok) window.location.reload();
                      return r;
                    }}
                  />
                </div>
              )}
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
          equipment={prices}
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
  equipment,
  online,
  busy,
  onClose,
  onBook,
}: {
  pick: Pick;
  date: string;
  day: DayRow[];
  discount: number;
  equipment: PriceItem[];
  online: boolean;
  busy: boolean;
  onClose: () => void;
  onBook: (o: {
    minutes: number;
    match: "open" | "private";
    privatePay: "whole" | "split";
    spots: 2 | 4;
    level?: number;
    levelMin?: number;
    levelMax?: number;
    equipment: EquipmentPick[];
    friends: { name: string; email: string; phone: string }[];
  }) => void;
}) {
  const c = pick.court;
  const fits = (m: number) => {
    const win = { start: pick.start, end: addMinutes(pick.start, m) };
    return (
      win.end <= hhmm(c.close_time) &&
      !day.some((t) => t.court_id === c.id && overlapsTime(win, { start: hhmm(t.start_time), end: hhmm(t.end_time) }))
    );
  };
  const lengths = lengthsOf(equipment).filter(fits);
  const [minutes, setMinutes] = useState(lengths[0] ?? 60);
  const [match, setMatch] = useState<"open" | "private" | "">("");
  const [privatePay, setPrivatePay] = useState<"whole" | "split">("split");
  const [spots, setSpots] = useState<2 | 4>(4);
  const [level, setLevel] = useState(2.5);
  const [picks, setPicks] = useState<EquipmentPick[]>([]);
  const [friends, setFriends] = useState<{ name: string; email: string; phone: string }[]>([]);
  const price = (m: number) => Math.round(priceFor(equipment, m) * (1 - discount / 100));
  const total = price(minutes);
  const each = Math.round(total / spots);
  const hostCourt = match === "" ? total : match === "private" && privatePay === "whole" ? total : total - each * (spots - 1);
  const equip = equipmentTotal(equipment, picks);
  const due = hostCourt + equip;

  return (
    <div className="crt-dlg" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="crt-dlg-in" role="dialog" aria-label={`${c.name}, ${pick.start}`}>
        <h2>{c.name}</h2>
        <p className="muted">
          {fmtDate(date, { weekday: "short", month: "short", day: "numeric" })} · {pick.start}
        </p>
        <div className="crt-lens">
          {lengthsOf(equipment).map((m) => (
            <button key={m} type="button" disabled={!lengths.includes(m)} className={m === minutes ? "on" : ""} onClick={() => setMinutes(m)}>
              <b>{durationLabel(m)}</b>
              <span>{lengths.includes(m) ? courtMoney(price(m), c.currency) : "Not free"}</span>
            </button>
          ))}
        </div>
        <div className="crt-two">
          <label>
            Players
            <select className="pv-input" value={spots} onChange={(e) => setSpots(Number(e.target.value) as 2 | 4)}>
              <option value={4}>4 · doubles</option>
              <option value={2}>2 · singles</option>
            </select>
          </label>
          <label>
            Kind of match
            <select className="pv-input" value={match} onChange={(e) => setMatch(e.target.value as "open" | "private")}>
              <option value="" disabled>Choose…</option>
              <option value="private">Private · friends join by link</option>
              <option value="open">Open · listed for anyone</option>
            </select>
          </label>
        </div>
        {match === "private" && (
          <>
            <div className="crt-two">
              <label>
                Who pays
                <select className="pv-input" value={privatePay} onChange={(e) => setPrivatePay(e.target.value as "whole" | "split")}>
                  <option value="split">Split · I pay my share</option>
                  <option value="whole">I pay the whole court</option>
                </select>
              </label>
            </div>
            {friends.map((f, i) => (
              <div key={i} className="crt-two" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
                <input className="pv-input" aria-label={`Friend ${i + 1} name`} placeholder="Name" value={f.name} onChange={(e) => setFriends((x) => x.map((y, j) => (j === i ? { ...y, name: e.target.value } : y)))} />
                <input className="pv-input" aria-label={`Friend ${i + 1} email`} type="email" placeholder="Email" value={f.email} onChange={(e) => setFriends((x) => x.map((y, j) => (j === i ? { ...y, email: e.target.value } : y)))} />
                <input className="pv-input" aria-label={`Friend ${i + 1} phone`} type="tel" placeholder="Phone" value={f.phone} onChange={(e) => setFriends((x) => x.map((y, j) => (j === i ? { ...y, phone: e.target.value } : y)))} />
              </div>
            ))}
            {friends.length < spots - 1 && (
              <button type="button" className="pv-btn ghost sm" onClick={() => setFriends((x) => [...x, { name: "", email: "", phone: "" }])}>
                + Add a friend now
              </button>
            )}
            <p className="muted" style={{ fontSize: 13 }}>Or send the join link after booking; each player needs a name, phone and email.</p>
          </>
        )}
        {match === "open" && (
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
          </div>
        )}
        <div className="crts">
          <EquipmentPicker items={equipment} picks={picks} onChange={setPicks} label="Your equipment (you pay for what you take)" />
        </div>
        <div className="crt-total">
          <span>
            {hostCourt === total && !equip ? "Total" : "You pay"}
            {discount ? <small> · {discount}% off</small> : null}
            <small> · court {courtMoney(total, c.currency)}{equip ? ` + equipment ${courtMoney(equip, c.currency)}` : ""} · VAT included</small>
          </span>
          <b>{courtMoney(due, c.currency)}</b>
        </div>
        <div className="crt-acts">
          <button type="button" className="pv-btn ghost" onClick={onClose}>Close</button>
          <button
            type="button"
            className="pv-btn"
            disabled={busy || !lengths.includes(minutes) || !match}
            onClick={() =>
              match &&
              onBook({
                minutes,
                match,
                privatePay,
                spots,
                equipment: picks,
                friends: match === "private" ? friends.filter((f) => f.name || f.email || f.phone) : [],
                ...(match === "open" ? { level, levelMin: Math.max(0, level - 1), levelMax: Math.min(7, level + 1) } : {}),
              })
            }
          >
            {busy ? "Booking…" : online && due > 0 ? "Pay" : "Book"}
          </button>
        </div>
      </div>
    </div>
  );
}
