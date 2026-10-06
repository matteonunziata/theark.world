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
  sportName,
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

/** The day's grid of slots, and the booking form that opens from a free one. */
export function CourtBooker({
  courts,
  day,
  date,
  today,
  now,
  me,
  isMember,
  online,
}: {
  courts: PublicCourt[];
  day: DayRow[];
  date: string;
  today: string;
  now: string;
  me: Me | null;
  isMember: boolean;
  online: boolean;
}) {
  const [pick, setPick] = useState<Pick | null>(null);

  const rowAt = (c: PublicCourt, s: { start: string; end: string }) =>
    day.find((r) => r.court_id === c.id && overlapsTime(s, { start: hhmm(r.start_time), end: hhmm(r.end_time) }));
  const gone = (start: string) => date < today || (date === today && start <= now);

  return (
    <>
      <div className="crts-grid">
        {courts.map((c) => (
          <section key={c.id} className="crts-court">
            <header>
              <h3>{c.name}</h3>
              <span className="sub">
                {sportName(c.sport)} · {hhmm(c.open_time)}–{hhmm(c.close_time)}
                {c.description ? ` · ${c.description}` : ""}
              </span>
              <span className="price">
                {courtMoney(c.price, c.currency)} per {durationLabel(c.slot_minutes)}
              </span>
            </header>
            {slots(c).map((s) => {
              const r = rowAt(c, s);
              const past = gone(s.start);
              if (r?.kind === "class") {
                return (
                  <div key={s.start} className="crts-slot class">
                    <span className="t">{s.start}</span>
                    <span className="what">{r.title}</span>
                  </div>
                );
              }
              if (r?.open_match && r.booking_id && r.spots && (r.players ?? 0) < r.spots) {
                return (
                  <Link key={s.start} href={`/courts/join/${r.booking_id}`} className="crts-slot open">
                    <span className="t">{s.start}</span>
                    <span className="what">
                      <b>Open match</b>
                      <small>
                        Level {levelRange(r.level_min, r.level_max)} · {r.spots - (r.players ?? 0)} spot
                        {r.spots - (r.players ?? 0) === 1 ? "" : "s"} left · {courtMoney(r.share, r.currency ?? c.currency)} each
                      </small>
                    </span>
                    <span className="go">Join</span>
                  </Link>
                );
              }
              if (r) {
                return (
                  <div key={s.start} className="crts-slot taken">
                    <span className="t">{s.start}</span>
                    <span className="what">{r.open_match ? "Match full" : "Taken"}</span>
                  </div>
                );
              }
              if (past) {
                return (
                  <div key={s.start} className="crts-slot gone">
                    <span className="t">{s.start}</span>
                    <span className="what">Passed</span>
                  </div>
                );
              }
              return (
                <button key={s.start} type="button" className="crts-slot free" onClick={() => setPick({ court: c, start: s.start })}>
                  <span className="t">{s.start}</span>
                  <span className="what">Free</span>
                  <span className="go">Book</span>
                </button>
              );
            })}
          </section>
        ))}
      </div>
      {pick && (
        <BookingForm
          key={`${pick.court.id}-${pick.start}`}
          pick={pick}
          day={day}
          date={date}
          me={me}
          isMember={isMember}
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
  isMember,
  online,
  onClose,
}: {
  pick: Pick;
  day: DayRow[];
  date: string;
  me: Me | null;
  isMember: boolean;
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
  const [openMatch, setOpenMatch] = useState(false);
  const [level, setLevel] = useState<number>(2.5);
  const [spots, setSpots] = useState<number>(Math.min(4, c.max_players));
  const [levelMin, setLevelMin] = useState<number>(1.5);
  const [levelMax, setLevelMax] = useState<number>(3.5);
  const [pay, setPay] = useState<"online" | "reception">(online ? "online" : "reception");
  const [result, setResult] = useState<CourtResult | null>(null);
  const [pending, start] = useTransition();

  const full = courtPrice(c, minutes);
  const discounted = me?.discount ? (c.currency === "USD" ? Math.round(full * (1 - me.discount / 100) * 100) / 100 : Math.round(full * (1 - me.discount / 100))) : full;
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
          {fmtDate(date, { weekday: "long", month: "long", day: "numeric" })}, {fmtTime(pick.start)}–{fmtTime(end)}
        </p>
        {result && !result.ok && (
          <div className="err" role="alert">
            {result.error}
          </div>
        )}
        <input name="website" className="hp" tabIndex={-1} autoComplete="off" aria-hidden="true" />

        <fieldset>
          <legend>How long</legend>
          <div className="opts">
            {durations(c).map((m) => {
              const ok = lengths.includes(m);
              return (
                <label key={m} className={!ok ? "off" : m === minutes ? "on" : ""}>
                  <input type="radio" name="minutes" value={m} checked={m === minutes} disabled={!ok} onChange={() => setMinutes(m)} />
                  <b>{durationLabel(m)}</b>
                  <span>{ok ? courtMoney(courtPrice(c, m), c.currency) : "Not free"}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="two">
          <div className="fld">
            <label htmlFor="cb-name">Your name</label>
            <input id="cb-name" name="name" required autoComplete="name" defaultValue={me?.name ?? ""} />
          </div>
          <div className="fld">
            <label htmlFor="cb-email">Email</label>
            <input id="cb-email" name="email" type="email" required autoComplete="email" defaultValue={me?.email ?? ""} readOnly={!!me?.email} />
            {me?.email && <span className="hint">From your membership.</span>}
          </div>
        </div>
        <div className="two">
          <div className="fld">
            <label htmlFor="cb-phone">WhatsApp (optional)</label>
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
            <b>Make it an open match</b>
            <span>Others can join from this page and pay their own share. You pay yours now.</span>
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
          <label htmlFor="cb-notes">Anything we should know (optional)</label>
          <textarea id="cb-notes" name="notes" rows={2} placeholder="Need rackets, a coach, a ball machine" />
        </div>

        {online && isMember && (
          <fieldset>
            <legend>Payment</legend>
            <div className="opts">
              <label className={pay === "online" ? "on" : ""}>
                <input type="radio" name="pay" checked={pay === "online"} onChange={() => setPay("online")} />
                <b>Pay by card now</b>
                <span>Confirmed right away</span>
              </label>
              <label className={pay === "reception" ? "on" : ""}>
                <input type="radio" name="pay" checked={pay === "reception"} onChange={() => setPay("reception")} />
                <b>Settle at reception</b>
                <span>Members only</span>
              </label>
            </div>
          </fieldset>
        )}

        <div className="total">
          <span>
            {openMatch ? "Your share" : "Total"}
            {me?.discount ? <small> · {me.discount}% member discount</small> : null}
            {openMatch ? <small> · {courtMoney(discounted, c.currency)} for the court</small> : null}
          </span>
          <b>{courtMoney(share, c.currency)}</b>
        </div>
        <p className="muted" style={{ fontSize: 13 }}>
          {pay === "online" && online
            ? `Next, pay by card. Your slot is held for ${HOLD_MINUTES} minutes while you do.`
            : "You’ll settle it at reception when you arrive."}{" "}
          Cancel up to 24 hours before.
        </p>
        <div className="acts">
          <button type="button" className="btn quiet" onClick={onClose}>Back</button>
          <button type="submit" className="btn solid" disabled={pending || !lengths.length}>
            {pending ? "One moment…" : pay === "online" && online ? "Continue to payment" : "Book"}
          </button>
        </div>
      </form>
    </div>
  );
}
