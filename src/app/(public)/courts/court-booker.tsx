"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  addMinutes,
  courtMoney,
  courtPrice,
  durationLabel,
  durations,
  hhmm,
  HOLD_MINUTES,
  LEVELS,
  levelRange,
  overlapsTime,
  type PublicCourt,
  slots,
} from "@/lib/courts";
import { fmtDate, fmtTime } from "@/lib/dates";
import { type CourtResult, holdCourt } from "./actions";

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

export type Me = { name: string; email: string; phone: string; discount: number };

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
}: {
  courts: PublicCourt[];
  day: DayRow[];
  date: string;
  today: string;
  now: string;
  me: Me | null;
  online: boolean;
}) {
  const [pick, setPick] = useState<Pick | null>(null);

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
                      onClick={() => setPick({ court: c, start: s.start })}
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
      </ul>
      {pick && (
        <BookingForm
          key={`${pick.court.id}-${pick.start}`}
          pick={pick}
          day={day}
          date={date}
          me={me}
          online={online}
          onClose={() => setPick(null)}
        />
      )}
    </>
  );
}

function BookingForm({
  pick,
  day,
  date,
  me,
  online,
  onClose,
}: {
  pick: Pick;
  day: DayRow[];
  date: string;
  me: Me | null;
  online: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const c = pick.court;
  // A longer booking needs the following slots free too.
  const canFit = (minutes: number) =>
    !day.some(
      (r) =>
        r.court_id === c.id &&
        overlapsTime({ start: pick.start, end: addMinutes(pick.start, minutes) }, { start: hhmm(r.start_time), end: hhmm(r.end_time) }),
    ) && addMinutes(pick.start, minutes) <= hhmm(c.close_time);
  const lengths = durations(c).filter(canFit);
  const [minutes, setMinutes] = useState(lengths[0] ?? c.slot_minutes);
  const [step, setStep] = useState<"length" | "details">("length");
  const [openMatch, setOpenMatch] = useState(false);
  const [level, setLevel] = useState<number>(2.5);
  const [spots, setSpots] = useState<number>(Math.min(4, c.max_players));
  const [levelMin, setLevelMin] = useState<number>(1.5);
  const [levelMax, setLevelMax] = useState<number>(3.5);
  const pay: "online" | "reception" = online ? "online" : "reception";
  const [result, setResult] = useState<CourtResult | null>(null);
  const [pending, start] = useTransition();

  const priced = (m: number) => {
    const full = courtPrice(c, m);
    if (!me?.discount) return full;
    const off = full * (1 - me.discount / 100);
    return c.currency === "USD" ? Math.round(off * 100) / 100 : Math.round(off);
  };
  const discounted = priced(minutes);
  const share = openMatch ? (c.currency === "USD" ? Math.round((discounted / spots) * 100) / 100 : Math.round(discounted / spots)) : discounted;
  const end = addMinutes(pick.start, minutes);
  const pickLevel = (v: number) => {
    setLevel(v);
    setLevelMin(Math.max(0, v - 1));
    setLevelMax(Math.min(7, v + 1));
  };

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
            {durations(c).map((m) => {
              const ok = lengths.includes(m);
              return (
                <button key={m} type="button" disabled={!ok} className={m === minutes ? "on" : ""} onClick={() => setMinutes(m)}>
                  <b>{durationLabel(m)}</b>
                  <span>{ok ? courtMoney(priced(m), c.currency) : "Not free"}</span>
                </button>
              );
            })}
          </div>
          {me?.discount ? <p className="muted note">{me.discount}% member discount applied.</p> : null}
          <button type="button" className="btn solid wide" disabled={!lengths.includes(minutes)} onClick={() => setStep("details")}>
            Continue · {courtMoney(discounted, c.currency)}
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
              players: openMatch ? spots : Number(fd.get("players")) || null,
              notes: String(fd.get("notes") ?? ""),
              openMatch,
              level: openMatch ? level : null,
              spots: openMatch ? spots : null,
              levelMin: openMatch ? levelMin : null,
              levelMax: openMatch ? levelMax : null,
              pay,
              website: String(fd.get("website") ?? ""),
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
        <input name="website" className="hp" tabIndex={-1} autoComplete="off" aria-hidden="true" />

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
            <label htmlFor="cb-phone">WhatsApp</label>
            <input id="cb-phone" name="phone" type="tel" autoComplete="tel" defaultValue={me?.phone ?? ""} />
          </div>
          {!openMatch && (
            <div className="fld">
              <label htmlFor="cb-players">Players</label>
              <input id="cb-players" name="players" type="number" min={1} max={8} defaultValue={c.sport === "padel" ? 4 : 2} />
            </div>
          )}
        </div>

        <label className="toggle">
          <input type="checkbox" checked={openMatch} onChange={(e) => setOpenMatch(e.target.checked)} />
          <span>
            <b>Open match</b>
            <span>Others join and pay their share.</span>
          </span>
        </label>

        {openMatch && (
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
                <label htmlFor="cb-spots">Players in total</label>
                <select id="cb-spots" value={spots} onChange={(e) => setSpots(Number(e.target.value))}>
                  {Array.from({ length: c.max_players - 1 }, (_, i) => i + 2).map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="two">
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
            </div>
          </>
        )}

        <div className="fld">
          <label htmlFor="cb-notes">Notes</label>
          <textarea id="cb-notes" name="notes" rows={2} placeholder="Rackets, coach…" />
        </div>


        <div className="total">
          <span>
            {openMatch ? "Your share" : "Total"}
            {me?.discount ? <small> · {me.discount}% off</small> : null}
            {openMatch ? <small> · court {courtMoney(discounted, c.currency)}</small> : null}
          </span>
          <b>{courtMoney(share, c.currency)}</b>
        </div>
        <p className="muted" style={{ fontSize: 13 }}>
          {pay === "online" && online ? `Pay by card next. Held ${HOLD_MINUTES} min.` : "Pay at reception."} Cancel free up to 24 h before.
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
