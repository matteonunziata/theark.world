"use client";

import { useState } from "react";

export type ClassSlot = {
  id: string;
  title: string;
  days: number[];
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  facilitator: string | null;
};

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const hm = (t: string | null) => (t ? t.slice(0, 5) : "");

export function Schedule({ classes, today }: { classes: ClassSlot[]; today: number }) {
  // Days are 0 (Sunday) to 6, shown Monday first; hide days with nothing on.
  const days = [1, 2, 3, 4, 5, 6, 0].filter((d) => classes.some((c) => c.days.includes(d)));
  const [day, setDay] = useState(days.includes(today) ? today : (days[0] ?? 1));
  const list = classes.filter((c) => c.days.includes(day));

  if (!days.length) {
    return <p className="ms-fine">The new season’s schedule is on its way.</p>;
  }
  return (
    <>
      <div className="ms-days" role="tablist" aria-label="Day">
        {days.map((d) => (
          <button
            key={d}
            type="button"
            role="tab"
            aria-selected={d === day}
            onClick={() => setDay(d)}
          >
            <span className="long">{DAYS[d]}</span>
            <span className="short">{DAYS[d].slice(0, 3)}</span>
          </button>
        ))}
      </div>
      <ul className="ms-sched" role="tabpanel">
        {list.map((c) => (
          <li key={c.id}>
            <span className="ms-time">
              {hm(c.start_time)}
              {c.end_time && ` – ${hm(c.end_time)}`}
            </span>
            <span>
              <b>{c.title}</b>
              <span className="ms-where">
                {[c.location, c.facilitator && `with ${c.facilitator.split(" ")[0]}`]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}
