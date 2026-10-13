import Link from "next/link";
import type { Tables } from "@/lib/database.types";
import { addDays, fmtDate, fmtTime } from "@/lib/dates";
import { scheduleFor } from "@/lib/school";

const days = (from: string, weekend: boolean) =>
  Array.from({ length: weekend ? 7 : 5 }, (_, i) => addDays(from, i));

/** This week's schedule, read-only. The timetable page is where it's edited. */
export function CalendarTab({
  entries,
  team,
  students,
  from,
  prev,
  next,
  today,
}: {
  entries: Tables<"school_schedule">[];
  team: { id: string; name: string }[];
  students: Tables<"students">[];
  from: string;
  prev: string;
  next: string;
  today: string;
}) {
  const weekend = [5, 6].some((i) => scheduleFor(entries, addDays(from, i)).length);
  const cols = days(from, weekend);
  const teacher = (id: string | null) => team.find((t) => t.id === id)?.name;
  const active = students.filter((s) => s.status === "active");
  const count = (group: string | null) => (group ? active.filter((s) => s.group_name === group).length : active.length);
  const href = (w: string) => `/arkadia?tab=calendar&week=${w}`;

  return (
    <>
      <div className="toolbar">
        <div className="weeknav" style={{ margin: 0 }}>
          <Link className="btn sm" href={href(prev)} aria-label="Previous week">←</Link>
          <Link className="btn sm" href={href(today)}>This week</Link>
          <Link className="btn sm" href={href(next)} aria-label="Next week">→</Link>
        </div>
        <span className="muted" style={{ fontSize: 13.5 }}>
          Week of {fmtDate(from, { month: "long", day: "numeric" })}
        </span>
        <Link className="btn" style={{ marginLeft: "auto" }} href="/arkadia/schedule">Edit timetable</Link>
      </div>
      {!entries.length ? (
        <div className="empty">
          <h2>No timetable yet</h2>
          <p>Add the regular week in the timetable and it will show here and on each family’s page.</p>
          <Link className="btn primary" href="/arkadia/schedule">Open timetable</Link>
        </div>
      ) : (
        <>
          <div className="tt" style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))` }}>
            {cols.map((date) => {
              const items = scheduleFor(entries, date);
              return (
                <section key={date} className={`tt-day ${date === today ? "today" : ""}`}>
                  <header>
                    <b>{fmtDate(date, { weekday: "short" })}</b>
                    <span>{fmtDate(date, { month: "short", day: "numeric" })}</span>
                  </header>
                  {items.length ? (
                    items.map((e) => (
                      <div key={e.id} className={`tt-item ${e.on_date ? "once" : ""}`}>
                        <span className="t">{fmtTime(e.start_time)}–{fmtTime(e.end_time)}</span>
                        <b>{e.title}</b>
                        <span className="m">
                          {[e.group_name ?? "Whole school", e.location, teacher(e.teacher_id), `${count(e.group_name)} students`]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </div>
                    ))
                  ) : (
                    <span className="muted" style={{ fontSize: 13 }}>No session</span>
                  )}
                </section>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
