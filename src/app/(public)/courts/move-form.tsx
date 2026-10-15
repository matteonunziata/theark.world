"use client";

import { useEffect, useState, useTransition } from "react";
import { courtMoney, durationLabel, hhmm, MOVE_HOURS, MOVE_LIMIT } from "@/lib/courts";
import { fmtTime } from "@/lib/dates";
import type { MoveResult } from "./actions";

/**
 * Pick a new day, length and start for a booking. The caller supplies how to
 * load the free start times and how to move (with the phone number check for the
 * private link, or the member's sign-in in the app).
 */
export function MoveForm({
  current,
  today,
  last,
  prices,
  movesLeft,
  loadStarts,
  onMove,
  onDone,
}: {
  current: { date: string; start: string; minutes: number };
  today: string;
  last: string;
  /** Court price by length in minutes. */
  prices: Record<number, number>;
  movesLeft: number;
  loadStarts: (date: string, minutes: number) => Promise<string[]>;
  onMove: (date: string, start: string, minutes: number) => Promise<MoveResult>;
  onDone?: () => void;
}) {
  const [date, setDate] = useState(current.date);
  const [minutes, setMinutes] = useState(current.minutes);
  const [loaded, setLoaded] = useState<{ key: string; list: string[] } | null>(null);
  const [picked, setPicked] = useState("");
  const [result, setResult] = useState<MoveResult | null>(null);
  const [pending, run] = useTransition();

  const key = `${date}|${minutes}`;
  const starts = loaded?.key === key ? loaded.list : null;
  const start = starts?.includes(picked) ? picked : (starts?.[0] ?? "");

  useEffect(() => {
    let live = true;
    loadStarts(date, minutes).then((list) => {
      if (live) setLoaded({ key: `${date}|${minutes}`, list });
    });
    return () => {
      live = false;
    };
  }, [date, minutes, loadStarts]);

  const diff = (prices[minutes] ?? 0) - (prices[current.minutes] ?? 0);

  if (result?.ok) {
    return (
      <div role="status">
        <b>Moved.</b> You’re now on {result.date} at {fmtTime(result.start)}–{fmtTime(result.end)}.
        {result.owed > 0 && <> The booking now has {courtMoney(result.owed, "CRC")} left to pay in total.</>}
        {result.credit > 0 && <> The shorter time leaves a credit of {courtMoney(result.credit, "CRC")}; the team will sort it out with you.</>}
        <p className="muted" style={{ fontSize: 13 }}>{result.movesLeft} move{result.movesLeft === 1 ? "" : "s"} left.</p>
        {onDone && <button type="button" className="btn" onClick={onDone}>Done</button>}
      </div>
    );
  }

  return (
    <div className="manage-form">
      <div className="two">
        <div className="fld">
          <label htmlFor="mv-date">New day</label>
          <input id="mv-date" type="date" min={today} max={last} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </div>
        <div className="fld">
          <label htmlFor="mv-len">Length</label>
          <select id="mv-len" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
            {Object.keys(prices).map(Number).sort((a, b) => a - b).map((m) => (
              <option key={m} value={m}>
                {durationLabel(m)} · {courtMoney(prices[m] ?? 0, "CRC")}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="fld">
        <label htmlFor="mv-start">Start</label>
        <select id="mv-start" value={start} onChange={(e) => setPicked(e.target.value)} disabled={!starts?.length}>
          {starts === null && <option>Looking…</option>}
          {starts?.length === 0 && <option value="">Nothing free that day</option>}
          {starts?.map((t) => (
            <option key={t} value={t}>
              {fmtTime(hhmm(t))}
            </option>
          ))}
        </select>
      </div>
      {diff !== 0 && (
        <p className="muted" style={{ fontSize: 13.5, margin: 0 }}>
          {diff > 0
            ? `A longer time costs ${courtMoney(diff, "CRC")} more. On a split booking it’s shared between the players; otherwise you pay it.`
            : `A shorter time isn’t refunded automatically. The difference of ${courtMoney(-diff, "CRC")} is noted as a credit for the team.`}
        </p>
      )}
      <p className="muted" style={{ fontSize: 13, margin: 0 }}>
        Up to {MOVE_HOURS} hours before the start, and {MOVE_LIMIT} times at most. {movesLeft} left.
      </p>
      {result && !result.ok && (
        <div className="err" role="alert">
          {result.error}
        </div>
      )}
      <button
        type="button"
        className="btn solid"
        disabled={pending || !start}
        onClick={() => run(async () => setResult(await onMove(date, start, minutes)))}
      >
        {pending ? "One moment…" : "Move booking"}
      </button>
    </div>
  );
}
