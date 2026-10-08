"use client";

import { useState } from "react";
import { addDays, DOW, fmtDate } from "@/lib/dates";

export type ClassSlot = {
  id: string;
  title: string;
  days: number[];
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  facilitator: string | null;
};

const hm = (t: string | null) => (t ? t.slice(0, 5) : "");
const dowOf = (s: string) => new Date(`${s}T00:00:00Z`).getUTCDay();

/** The next seven days, from today. Booking a class goes through the pricing section. */
export function Schedule({ classes, today }: { classes: ClassSlot[]; today: string }) {
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  const [day, setDay] = useState(today);
  const list = classes.filter((c) => c.days.includes(dowOf(day)));

  if (!classes.length) {
    return <p className="ms-fine">The new season’s schedule is on its way.</p>;
  }
  return (
    <>
      <div className="ms-days" role="tablist" aria-label="Day">
        {week.map((d, i) => (
          <button key={d} type="button" role="tab" aria-selected={d === day} onClick={() => setDay(d)}>
            <span className="long">{i === 0 ? "Today" : fmtDate(d, { weekday: "long", month: "short", day: "numeric" })}</span>
            <span className="short">
              {DOW[dowOf(d)]} {Number(d.slice(8))}
            </span>
          </button>
        ))}
      </div>
      <ul className="ms-sched" role="tabpanel">
        {list.length ? (
          list.map((c) => (
            <li key={c.id}>
              <span className="ms-time">
                {hm(c.start_time)}
                {c.end_time && ` – ${hm(c.end_time)}`}
              </span>
              <span>
                <b>{c.title}</b>
                <span className="ms-where">
                  {[c.location, c.facilitator && `with ${c.facilitator.split(" ")[0]}`].filter(Boolean).join(" · ")}
                </span>
              </span>
              <a className="ms-btn small ms-book" href="#pricing">
                Book a class
              </a>
            </li>
          ))
        ) : (
          <li>
            <span className="ms-where">Nothing on this day.</span>
          </li>
        )}
      </ul>
    </>
  );
}
