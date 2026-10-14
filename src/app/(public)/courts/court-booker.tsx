"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  addMinutes,
  CANCEL_HOURS,
  courtMoney,
  courtPrice,
  durationLabel,
  durations,
  type EquipmentPick,
  equipmentTotal,
  hhmm,
  HOLD_MINUTES,
  LEVELS,
  levelRange,
  overlapsTime,
  type PriceItem,
  type PublicCourt,
  slots,
} from "@/lib/courts";
import { fmtDate, fmtTime } from "@/lib/dates";
import { type CourtResult, holdCourt } from "./actions";
import { EquipmentPicker } from "./equipment-picker";

export type DayRow = {
  court_id: string;
  start_time: string;
  end_time: string;
  kind: string;
  title: string | null;
  booking_id: string | null;
  open_match: boolean;
  level_min: number | null;
  level_max: number | null;
  spots: number | null;
  players: number | null;
  host: string | null;
  share: number | null;
  currency: string | null;
};

export type Me = { name: string; email: string; phone: string };

type Pick = { court: PublicCourt; start: string };

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
};
const hourLabel = (h: number) => `${h % 12 || 12} ${h < 12 || h === 24 ? "AM" : "PM"}`;

/** The day as a grid: a row per court, a column per hour. Tap a free cell to book it. */
export function CourtBooker({
  courts,
  day,
  date,
  today,
  now,
  me,
  online,
  equipment,
}: {
  courts: PublicCourt[];
  day: DayRow[];
  date: string;
  today: string;
  now: string;
  me: Me | null;
  online: boolean;
  equipment: PriceItem[];
}) {
  const [pick, setPick] = useState<Pick | null>(null);
  return (
    <>
      <CourtGrid courts={courts} day={day} date={date} today={today} now={now} onPick={(court, start) => setPick({ court, start })} />
      {pick && (
        <BookingForm
          key={`${pick.court.id}-${pick.start}`}
          pick={pick}
          day={day}
          date={date}
          me={me}
          online={online}
          equipment={equipment}
          onClose={() => setPick(null)}
        />
      )}
    </>
  );
}

/** The grid and its legend, without a booking form: the caller decides what a free cell does. */
export function CourtGrid({
  courts,
  day,
  date,
  today,
  now,
  onPick,
}: {
  courts: PublicCourt[];
  day: DayRow[];
  date: string;
  today: string;
  now: string;
  onPick: (court: PublicCourt, start: string) => void;
}) {

  const from = Math.floor(Math.min(...courts.map((c) => toMin(hhmm(c.open_time)))) / 60);
  const to = Math.ceil(Math.max(...courts.map((c) => toMin(hhmm(c.close_time)))) / 60);
  const hours = Array.from({ length: to - from }, (_, i) => from + i);
  const span = (to - from) * 60;
  const place = (start: string, end: string) => ({
    left: `${((toMin(start) - from * 60) / span) * 100}%`,
    width: `${((toMin(end) - toMin(start)) / span) * 100}%`,
  });
  const gone = (start: string) => date < today || (date === today && start <= now);

  return (
    <>
      <div className="crts-cal" style={{ "--cols": hours.length } as React.CSSProperties}>
        <div className="crts-cal-in">
          <div className="crts-cal-row head">
            <div className="crts-cal-name" />
            <div className="crts-cal-hours">
              {hours.map((h) => (
                <span key={h}>{hourLabel(h)}</span>
              ))}
            </div>
          </div>
          {courts.map((c) => {
            const open = hhmm(c.open_time);
            const close = hhmm(c.close_time);
            const rows = day.filter((r) => r.court_id === c.id);
            const free = slots(c).filter(
              (s) => !gone(s.start) && !rows.some((r) => overlapsTime(s, { start: hhmm(r.start_time), end: hhmm(r.end_time) })),
            );
            return (
              <div key={c.id} className="crts-cal-row">
                <div className="crts-cal-name">{c.name}</div>
                <div className="crts-cal-track">
                  {toMin(open) > from * 60 && <span className="blk off" style={place(`${String(from).padStart(2, "0")}:00`, open)} />}
                  {toMin(close) < to * 60 && <span className="blk off" style={place(close, `${String(to).padStart(2, "0")}:00`)} />}
                  {date === today && toMin(now) > toMin(open) && (
                    <span
                      className="blk off"
                      style={place(open, toMin(now) >= toMin(close) ? close : now)}
                    />
                  )}
                  {date < today && <span className="blk off" style={place(open, close)} />}
                  {rows.map((r, i) => {
                    const st = hhmm(r.start_time);
                    const en = hhmm(r.end_time);
                    if (r.kind === "class") {
                      return (
                        <span key={`c${i}`} className="blk class" style={place(st, en)} title={r.title ?? "Class"}>
                          {r.title}
                        </span>
                      );
                    }
                    if (r.open_match && r.booking_id && r.spots && (r.players ?? 0) < r.spots) {
                      const left = r.spots - (r.players ?? 0);
                      return (
                        <Link
                          key={`b${i}`}
                          href={`/courts/join/${r.booking_id}`}
                          className="blk match"
                          style={place(st, en)}
                          title={`Open match, level ${levelRange(r.level_min, r.level_max)}, ${left} spot${left === 1 ? "" : "s"} left, ${courtMoney(r.share, r.currency ?? c.currency)} each`}
                        >
                          <b>Join</b>
                          <small>{left} left</small>
                        </Link>
                      );
                    }
                    return <span key={`b${i}`} className="blk taken" style={place(st, en)} title="Booked" />;
                  })}
                  {free.map((s) => (
                    <button
                      key={s.start}
                      type="button"
                      className="blk free"
                      style={place(s.start, s.end)}
                      aria-label={`${c.name}, ${fmtTime(s.start)}`}
                      onClick={() => onPick(c, s.start)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <ul className="crts-legend">
        <li><i className="free" />Available</li>
        <li><i className="taken" />Not available</li>
        <li><i className="match" />Open match</li>
        <li><i className="class" />Class</li>
      </ul>
    </>
  );
}

type Friend = { name: string; email: string; phone: string };

function BookingForm({
  pick,
  day,
  date,
  me,
  online,
  equipment,
  onClose,
}: {
  pick: Pick;
  day: DayRow[];
  date: string;
  me: Me | null;
  online: boolean;
  equipment: PriceItem[];
  onClose: () => void;
}) {
  const router = useRouter();
  const c = pick.court;
  // A longer booking needs the following half hours free too.
  const canFit = (minutes: number) =>
    !day.some(
      (r) =>
        r.court_id === c.id &&
        overlapsTime({ start: pick.start, end: addMinutes(pick.start, minutes) }, { start: hhmm(r.start_time), end: hhmm(r.end_time) }),
    ) && addMinutes(pick.start, minutes) <= hhmm(c.close_time);
  const lengths = durations().filter(canFit);
  const [minutes, setMinutes] = useState(lengths[0] ?? 60);
  const [step, setStep] = useState<"length" | "details">("length");
  const [match, setMatch] = useState<"open" | "private">("private");
  const [privatePay, setPrivatePay] = useState<"whole" | "split">("split");
  const [spots, setSpots] = useState<2 | 4>(4);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [picks, setPicks] = useState<EquipmentPick[]>([]);
  const [level, setLevel] = useState<number>(2.5);
  const [levelMin, setLevelMin] = useState<number>(1.5);
  const [levelMax, setLevelMax] = useState<number>(3.5);
  const pay: "online" | "reception" = online ? "online" : "reception";
  const [result, setResult] = useState<CourtResult | null>(null);
  const [pending, start] = useTransition();

  const court = courtPrice(c, minutes);
  const each = Math.round(court / spots);
  const hostCourt = match === "private" && privatePay === "whole" ? court : court - each * (spots - 1);
  const equip = equipmentTotal(equipment, picks);
  const due = hostCourt + equip;
  const end = addMinutes(pick.start, minutes);
  const pickLevel = (v: number) => {
    setLevel(v);
    setLevelMin(Math.max(0, v - 1));
    setLevelMax(Math.min(7, v + 1));
  };
  const setFriend = (i: number, patch: Partial<Friend>) => setFriends((f) => f.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (step === "length") {
    return (
      <div className="crts-dialog" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="crts-form crts-pick" role="dialog" aria-label={`${c.name}, ${fmtTime(pick.start)}`}>
          <h2>{c.name}</h2>
          <p className="lead">
            {fmtDate(date, { weekday: "short", month: "short", day: "numeric" })} · {fmtTime(pick.start)}
          </p>
          <div className="lens">
            {durations().map((m) => {
              const ok = lengths.includes(m);
              return (
                <button key={m} type="button" disabled={!ok} className={m === minutes ? "on" : ""} onClick={() => setMinutes(m)}>
                  <b>{durationLabel(m)}</b>
                  <span>{ok ? courtMoney(courtPrice(c, m), c.currency) : "Not free"}</span>
                </button>
              );
            })}
          </div>
          <button type="button" className="btn solid wide" disabled={!lengths.includes(minutes)} onClick={() => setStep("details")}>
            Continue · {courtMoney(court, c.currency)}
          </button>
          <button type="button" className="btn quiet wide" onClick={onClose}>Close</button>
        </div>
      </div>
    );
  }

  return (
    <div className="crts-dialog" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form
        className="crts-form"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          start(async () => {
            const r = await holdCourt({
              courtId: c.id,
              date,
              start: pick.start,
              minutes,
              name: String(fd.get("name") ?? ""),
              email: String(fd.get("email") ?? ""),
              phone: String(fd.get("phone") ?? ""),
              notes: String(fd.get("notes") ?? ""),
              match,
              privatePay,
              spots,
              level: match === "open" ? level : null,
              levelMin: match === "open" ? levelMin : null,
              levelMax: match === "open" ? levelMax : null,
              friends: match === "private" ? friends.filter((f) => f.name || f.email || f.phone) : [],
              equipment: picks,
              website: String(fd.get("ms_trap_x") ?? ""),
            });
            setResult(r);
            if (r.ok) {
              if (r.payUrl) window.location.assign(r.payUrl);
              else router.push(`/courts/b/${r.token}`);
            }
          });
        }}
      >
        <h2>{c.name}</h2>
        <p className="lead">
          {fmtDate(date, { weekday: "short", month: "short", day: "numeric" })} · {fmtTime(pick.start)}–{fmtTime(end)} · {durationLabel(minutes)}
        </p>
        {result && !result.ok && (
          <div className="err" role="alert">
            {result.error}
          </div>
        )}
        <input name="ms_trap_x" className="hp" tabIndex={-1} autoComplete="off" aria-hidden="true" />

        <div className="two">
          <div className="fld">
            <label htmlFor="cb-name">Name</label>
            <input id="cb-name" name="name" required autoComplete="name" defaultValue={me?.name ?? ""} />
          </div>
          <div className="fld">
            <label htmlFor="cb-email">Email</label>
            <input id="cb-email" name="email" type="email" required autoComplete="email" defaultValue={me?.email ?? ""} readOnly={!!me?.email} />
          </div>
        </div>
        <div className="two">
          <div className="fld">
            <label htmlFor="cb-phone">Phone (WhatsApp)</label>
            <input id="cb-phone" name="phone" type="tel" required autoComplete="tel" defaultValue={me?.phone ?? ""} />
          </div>
          <div className="fld">
            <label htmlFor="cb-spots">Players</label>
            <select id="cb-spots" value={spots} onChange={(e) => setSpots(Number(e.target.value) as 2 | 4)}>
              <option value={4}>4 · doubles</option>
              <option value={2}>2 · singles</option>
            </select>
          </div>
        </div>

        <div className="choice" role="group" aria-label="Kind of match">
          <button type="button" className={match === "private" ? "on" : ""} onClick={() => setMatch("private")}>
            <b>Private match</b>
            <span>Not listed. Friends join with your link.</span>
          </button>
          <button type="button" className={match === "open" ? "on" : ""} onClick={() => setMatch("open")}>
            <b>Open match</b>
            <span>Listed publicly. Others join and pay their share.</span>
          </button>
        </div>

        {match === "private" && (
          <>
            <div className="choice" role="group" aria-label="Who pays">
              <button type="button" className={privatePay === "split" ? "on" : ""} onClick={() => setPrivatePay("split")}>
                <b>Split it</b>
                <span>You pay your share ({courtMoney(each, c.currency)}); friends pay theirs.</span>
              </button>
              <button type="button" className={privatePay === "whole" ? "on" : ""} onClick={() => setPrivatePay("whole")}>
                <b>I pay the whole court</b>
                <span>Friends only add their names.</span>
              </button>
            </div>
            <p className="muted" style={{ fontSize: 13.5, margin: "0 0 8px" }}>
              Add your friends now, or send them your link after booking. We need each player’s name, phone and email.
            </p>
            {friends.map((f, i) => (
              <div key={i} className="friend">
                <input aria-label={`Friend ${i + 1} name`} placeholder="Name" value={f.name} onChange={(e) => setFriend(i, { name: e.target.value })} />
                <input aria-label={`Friend ${i + 1} email`} type="email" placeholder="Email" value={f.email} onChange={(e) => setFriend(i, { email: e.target.value })} />
                <input aria-label={`Friend ${i + 1} phone`} type="tel" placeholder="Phone" value={f.phone} onChange={(e) => setFriend(i, { phone: e.target.value })} />
              </div>
            ))}
            {friends.length < spots - 1 && (
              <button type="button" className="btn sm" style={{ marginBottom: 14 }} onClick={() => setFriends((f) => [...f, { name: "", email: "", phone: "" }])}>
                + Add a friend
              </button>
            )}
          </>
        )}

        {match === "open" && (
          <>
            <div className="two">
              <div className="fld">
                <label htmlFor="cb-level">Your level</label>
                <select id="cb-level" value={level} onChange={(e) => pickLevel(Number(e.target.value))}>
                  {LEVELS.map(([v, name]) => (
                    <option key={v} value={v}>
                      {v} · {name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="fld">
                <label htmlFor="cb-lmin">Level from</label>
                <select id="cb-lmin" value={levelMin} onChange={(e) => setLevelMin(Number(e.target.value))}>
                  {Array.from({ length: 15 }, (_, i) => i / 2).map((v) => (
                    <option key={v} value={v} disabled={v > levelMax}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="fld">
              <label htmlFor="cb-lmax">Level to</label>
              <select id="cb-lmax" value={levelMax} onChange={(e) => setLevelMax(Number(e.target.value))}>
                {Array.from({ length: 15 }, (_, i) => i / 2).map((v) => (
                  <option key={v} value={v} disabled={v < levelMin}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        <EquipmentPicker items={equipment} picks={picks} onChange={setPicks} label="Your equipment (you pay for what you take)" />

        <div className="fld">
          <label htmlFor="cb-notes">Notes</label>
          <textarea id="cb-notes" name="notes" rows={2} placeholder="Anything we should know" />
        </div>

        <div className="total">
          <span>
            {hostCourt === court && !equip ? "Total" : "You pay"}
            <small> · court {courtMoney(court, c.currency)}{equip ? ` + equipment ${courtMoney(equip, c.currency)}` : ""} · VAT included</small>
          </span>
          <b>{courtMoney(due, c.currency)}</b>
        </div>
        <p className="muted" style={{ fontSize: 13 }}>
          {pay === "online" && online ? `Pay by card next. Held ${HOLD_MINUTES} min.` : "Pay at reception."} Cancel free up to {CANCEL_HOURS} h before.
          After booking you get a private link to move or cancel it.
        </p>
        <div className="acts">
          <button type="button" className="btn quiet" onClick={() => setStep("length")}>Back</button>
          <button type="submit" className="btn solid" disabled={pending || !lengths.length}>
            {pending ? "One moment…" : pay === "online" && online ? "Pay" : "Book"}
          </button>
        </div>
      </form>
    </div>
  );
}
