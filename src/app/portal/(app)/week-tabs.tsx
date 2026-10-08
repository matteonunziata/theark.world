"use client";

import { useState } from "react";

export type WeekDay = { date: string; label: string; count: number; content: React.ReactNode };

/** The week's days as pills; picking one shows that day's classes, events and experiences. */
export function WeekTabs({ days, initial }: { days: WeekDay[]; initial: string }) {
  const [day, setDay] = useState(initial);
  const current = days.find((d) => d.date === day) ?? days[0];
  return (
    <>
      <div className="pv-pills" role="tablist" aria-label="Day of the week">
        {days.map((d) => (
          <button
            key={d.date}
            type="button"
            role="tab"
            className="pv-pill"
            aria-selected={d.date === current.date}
            onClick={() => setDay(d.date)}
          >
            {d.label}
            {d.count > 0 && <span style={{ opacity: 0.6 }}> · {d.count}</span>}
          </button>
        ))}
      </div>
      <div role="tabpanel">{current.content}</div>
    </>
  );
}
