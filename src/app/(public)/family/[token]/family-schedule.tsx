"use client";

import { useState } from "react";
import { addDays, DOW, fmtDate, fmtTime, weekStart } from "@/lib/dates";
import { type ScheduleEntry, scheduleFor } from "@/lib/school";

/** A child's school day and week, for their family. */
export function FamilySchedule({
  entries,
  today,
  first,
}: {
  entries: ScheduleEntry[];
  today: string;
  first: string;
}) {
  const [view, setView] = useState<"day" | "week">("day");
  const [date, setDate] = useState(today);
  const monday = weekStart(date);
  const week = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const schoolDays = week.filter((d, i) => i < 5 || scheduleFor(entries, d).length > 0);
  const day = scheduleFor(entries, date);

  return (
    <section className="family-sched" aria-label={`${first}’s schedule`}>
      <div className="fs-head">
        <h2>{first}’s {view === "day" ? "day" : "week"}</h2>
        <div className="fs-toggle" role="group" aria-label="View">
          {(["day", "week"] as const).map((v) => (
            <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}>
              {v === "day" ? "Day" : "Week"}
            </button>
          ))}
        </div>
      </div>
      <div className="fs-nav">
        <button type="button" onClick={() => setDate(addDays(date, view === "day" ? -1 : -7))} aria-label="Earlier">←</button>
        <span>
          {view === "day"
            ? date === today
              ? `Today, ${fmtDate(date, { month: "long", day: "numeric" })}`
              : fmtDate(date, { weekday: "long", month: "long", day: "numeric" })
            : `Week of ${fmtDate(monday, { month: "long", day: "numeric" })}`}
        </span>
        <button type="button" onClick={() => setDate(addDays(date, view === "day" ? 1 : 7))} aria-label="Later">→</button>
        {date !== today && (
          <button type="button" className="fs-today" onClick={() => setDate(today)}>Today</button>
        )}
      </div>

      {view === "day" ? (
        <>
          <div className="fs-strip">
            {week.map((d) => (
              <button key={d} type="button" aria-pressed={d === date} className={d === today ? "today" : ""} onClick={() => setDate(d)}>
                <span>{DOW[new Date(`${d}T00:00:00Z`).getUTCDay()]}</span>
                <b>{Number(d.slice(8))}</b>
              </button>
            ))}
          </div>
          {day.length ? (
            <ol className="fs-list">
              {day.map((e) => (
                <li key={e.id} className={e.on_date ? "once" : ""}>
                  <span className="t">
                    {fmtTime(e.start_time)}
                    <small>{fmtTime(e.end_time)}</small>
                  </span>
                  <span>
                    <b>{e.title}</b>
                    {(e.location || e.teacher) && (
                      <span className="m">{[e.location, e.teacher ? `with ${e.teacher}` : null].filter(Boolean).join(" · ")}</span>
                    )}
                    {e.notes && <span className="n">{e.notes}</span>}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="none">No school on this day.</p>
          )}
        </>
      ) : (
        <div className="fs-week">
          {schoolDays.map((d) => {
            const items = scheduleFor(entries, d);
            return (
              <div key={d} className={`fs-wd ${d === today ? "today" : ""}`}>
                <button type="button" className="fs-wd-h" onClick={() => { setDate(d); setView("day"); }}>
                  <b>{fmtDate(d, { weekday: "long" })}</b>
                  <span>{fmtDate(d, { month: "short", day: "numeric" })}</span>
                </button>
                {items.length ? (
                  items.map((e) => (
                    <div key={e.id} className={`fs-wi ${e.on_date ? "once" : ""}`}>
                      <span>{fmtTime(e.start_time)}</span> {e.title}
                    </div>
                  ))
                ) : (
                  <div className="fs-wi off">No school</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
