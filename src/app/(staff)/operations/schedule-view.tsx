"use client";

import { useState } from "react";
import { ConfirmButton, Drawer } from "@/components/drawer";
import type { Tables } from "@/lib/database.types";
import {
  CLEAN_DAYS,
  cleanDayOf,
  clock,
  endClock,
  hoursLabel,
  qty,
  toMinutes,
  weekHours,
} from "@/lib/hospitality";
import { money } from "@/lib/schedule";
import { saveCleaningStaff, saveCleaningTask } from "./schedule-actions";

type Task = Tables<"cleaning_tasks">;
type Person = Tables<"cleaning_staff">;
type Draft = { staff_id?: string; day?: number; start?: string };

const PX = 56; // pixels per hour in the day grid

const DAY_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function ScheduleView({
  kind,
  tasks,
  staff,
  today,
}: {
  kind: "cleaning" | "maintenance";
  tasks: Task[];
  staff: Person[];
  today: string;
}) {
  const todayIdx = cleanDayOf(today);
  const [view, setView] = useState<"day" | "week">("day");
  const [day, setDay] = useState(todayIdx);
  const [task, setTask] = useState<Task | null>(null);
  const [draft, setDraft] = useState<Draft>({});
  const [taskOpen, setTaskOpen] = useState(false);
  const [taskKey, setTaskKey] = useState(0);
  const [person, setPerson] = useState<Person | null>(null);
  const [personOpen, setPersonOpen] = useState(false);
  const [personKey, setPersonKey] = useState(0);

  const editTask = (t: Task | null, d: Draft = {}) => {
    setTask(t);
    setDraft(d);
    setTaskKey((k) => k + 1);
    setTaskOpen(true);
  };
  const editPerson = (p: Person | null) => {
    setPerson(p);
    setPersonKey((k) => k + 1);
    setPersonOpen(true);
  };

  const dayTasks = tasks.filter((t) => t.days.includes(day));
  const timed = dayTasks.filter((t) => t.start_time && t.hours);
  const untimed = dayTasks.filter((t) => !(t.start_time && t.hours));
  const startH = Math.min(7, ...timed.map((t) => Math.floor(toMinutes(t.start_time as string) / 60)));
  const endH = Math.max(
    16,
    ...timed.map((t) => Math.ceil((toMinutes(t.start_time as string) + Number(t.hours) * 60) / 60)),
  );
  const hourMarks = Array.from({ length: endH - startH }, (_, i) => startH + i);
  const hasUnassigned = dayTasks.some((t) => !t.staff_id);
  const columns: { id: string | null; name: string; color: string }[] = [
    ...staff.map((s) => ({ id: s.id as string | null, name: s.name, color: s.color })),
    ...(hasUnassigned ? [{ id: null, name: "Unassigned", color: "#8a8a8a" }] : []),
  ];

  const colorOf = (t: Task) => staff.find((s) => s.id === t.staff_id)?.color ?? "#8a8a8a";

  return (
    <>
      <div className="listings-h">
        <div className="pill-row" style={{ margin: 0 }} role="group" aria-label="View">
          {(["day", "week"] as const).map((v) => (
            <button key={v} type="button" className="pill" aria-pressed={view === v} onClick={() => setView(v)}>
              {v === "day" ? "Day" : "Week and pay"}
            </button>
          ))}
        </div>
        <span className="spacer" />
        <button type="button" className="btn sm" onClick={() => editPerson(null)}>Add person</button>
        <button type="button" className="btn primary sm" onClick={() => editTask(null, view === "day" ? { day } : {})}>
          Add task
        </button>
      </div>

      {view === "day" ? (
        <>
          <div className="pill-row" role="group" aria-label="Day of the week">
            {CLEAN_DAYS.map((d, i) => (
              <button
                key={d}
                type="button"
                className="pill"
                aria-pressed={day === i}
                onClick={() => setDay(i)}
              >
                {d}
                {i === todayIdx ? " · today" : ""}
              </button>
            ))}
          </div>
          {staff.length === 0 ? (
            <p className="muted">Add the team first, then schedule their tasks.</p>
          ) : (
            <div className="sched" style={{ gridTemplateColumns: `52px repeat(${columns.length}, minmax(130px, 1fr))` }}>
              <div />
              {columns.map((c) => (
                <div key={c.name} className="sched-head" style={{ color: c.color }}>{c.name}</div>
              ))}
              <div className="sched-hours" style={{ height: (endH - startH) * PX }}>
                {hourMarks.map((h) => (
                  <span key={h} style={{ top: (h - startH) * PX }}>{h}:00</span>
                ))}
              </div>
              {columns.map((c) => {
                const mine = timed.filter((t) => (t.staff_id ?? null) === c.id);
                return (
                  <div
                    key={c.name}
                    className="sched-col"
                    style={{ height: (endH - startH) * PX, backgroundSize: `100% ${PX}px` }}
                    onClick={(e) => {
                      const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
                      const mins = Math.round(((y / PX) * 60) / 30) * 30 + startH * 60;
                      editTask(null, {
                        staff_id: c.id ?? undefined,
                        day,
                        start: `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`,
                      });
                    }}
                  >
                    {mine.length === 0 && dayTasks.every((t) => t.staff_id !== c.id) && (
                      <span className="sched-free">Free</span>
                    )}
                    {mine.map((t) => {
                      const top = ((toMinutes(t.start_time as string) - startH * 60) / 60) * PX;
                      const h = Number(t.hours) * PX;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          className="sched-block"
                          style={{ top, height: h - 2, ["--c" as string]: colorOf(t) }}
                          onClick={(e) => {
                            e.stopPropagation();
                            editTask(t);
                          }}
                        >
                          <strong>{t.task}</strong>
                          {h >= 44 && (
                            <span>
                              {t.area} · {clock(t.start_time as string)}–{endClock(t.start_time as string, Number(t.hours))}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
          {untimed.length > 0 && (
            <p className="muted" style={{ marginTop: 14 }}>
              No time set:{" "}
              {untimed.map((t, i) => (
                <span key={t.id}>
                  {i > 0 && ", "}
                  <button type="button" className="linkish" onClick={() => editTask(t)}>
                    {t.task}
                    {t.staff_id ? ` (${staff.find((s) => s.id === t.staff_id)?.name})` : ""}
                  </button>
                </span>
              ))}
            </p>
          )}
          <p className="muted" style={{ fontSize: 13.5, marginTop: 14 }}>
            {DAY_LONG[day]}: select a task to change it, or an empty spot to add one there.
          </p>
        </>
      ) : (
        <WeekPay tasks={tasks} staff={staff} todayIdx={todayIdx} onPerson={editPerson} onDay={(i) => { setDay(i); setView("day"); }} />
      )}

      <Drawer
        key={`t${taskKey}`}
        title={task ? "Edit task" : "Add a task"}
        open={taskOpen}
        onClose={() => setTaskOpen(false)}
        action={saveCleaningTask}
        footer={
          <>
            {task && <ConfirmButton />}
            <span className="spacer" />
            <button type="button" className="btn ghost" onClick={() => setTaskOpen(false)}>Cancel</button>
            <button type="submit" className="btn primary">Save</button>
          </>
        }
      >
        <input type="hidden" name="kind" value={kind} />
        {task && <input type="hidden" name="id" value={task.id} />}
        <div className="fld">
          <label htmlFor="cl-task">Task</label>
          <input id="cl-task" name="task" required defaultValue={task?.task ?? ""} placeholder={kind === "maintenance" ? "Fix the deck rail" : "Deck limpieza profunda"} />
        </div>
        <div className="grid2">
          <div className="fld">
            <label htmlFor="cl-area">Where</label>
            <input id="cl-area" name="area" list="cl-areas" required defaultValue={task?.area ?? ""} placeholder="The Ark House" />
            <datalist id="cl-areas">
              {[...new Set(tasks.map((t) => t.area))].map((a) => <option key={a} value={a} />)}
            </datalist>
          </div>
          <div className="fld">
            <label htmlFor="cl-who">Who</label>
            <select id="cl-who" name="staff_id" defaultValue={task?.staff_id ?? draft.staff_id ?? ""}>
              <option value="">Unassigned</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
        <div className="grid2">
          <div className="fld">
            <label htmlFor="cl-start">Starts</label>
            <input id="cl-start" name="start_time" type="time" step={900} defaultValue={task?.start_time?.slice(0, 5) ?? draft.start ?? ""} />
          </div>
          <div className="fld">
            <label htmlFor="cl-hours">Length (hours)</label>
            <input id="cl-hours" name="hours" type="number" inputMode="decimal" min={0} max={24} step={0.25} defaultValue={task?.hours ? qty(task.hours) : "1"} />
          </div>
        </div>
        <div className="fld">
          <span className="lbl">Days</span>
          <div className="pill-row" style={{ marginBottom: 0 }}>
            {CLEAN_DAYS.map((d, i) => (
              <label key={d} className="check">
                <input type="checkbox" name="days" value={i} defaultChecked={task ? task.days.includes(i) : draft.day === i} />
                {d}
              </label>
            ))}
          </div>
        </div>
        <div className="fld">
          <label htmlFor="cl-notes">Notes</label>
          <textarea id="cl-notes" name="notes" rows={3} defaultValue={task?.notes ?? ""} />
        </div>
      </Drawer>

      <Drawer
        key={`p${personKey}`}
        title={person ? person.name : "Add a person"}
        open={personOpen}
        onClose={() => setPersonOpen(false)}
        action={saveCleaningStaff}
        footer={
          <>
            {person && <ConfirmButton />}
            <span className="spacer" />
            <button type="button" className="btn ghost" onClick={() => setPersonOpen(false)}>Cancel</button>
            <button type="submit" className="btn primary">Save</button>
          </>
        }
      >
        <input type="hidden" name="kind" value={kind} />
        {person && <input type="hidden" name="id" value={person.id} />}
        <div className="fld">
          <label htmlFor="cs-name">Name</label>
          <input id="cs-name" name="name" required defaultValue={person?.name ?? ""} />
        </div>
        <div className="grid2">
          <div className="fld">
            <label htmlFor="cs-rate">Hourly rate</label>
            <input id="cs-rate" name="hourly_rate" inputMode="decimal" defaultValue={person?.hourly_rate ?? ""} />
          </div>
          <div className="fld">
            <label htmlFor="cs-cur">Currency</label>
            <select id="cs-cur" name="currency" defaultValue={person?.currency ?? "CRC"}>
              <option value="CRC">Colones</option>
              <option value="USD">Dollars</option>
            </select>
          </div>
        </div>
        <div className="fld">
          <label htmlFor="cs-color">Colour on the schedule</label>
          <input id="cs-color" name="color" type="color" defaultValue={person?.color ?? "#4a63b0"} style={{ width: 64, padding: 2 }} />
        </div>
      </Drawer>
    </>
  );
}

/** Hours per person per day, the week's total, and what it costs. */
function WeekPay({
  tasks,
  staff,
  todayIdx,
  onPerson,
  onDay,
}: {
  tasks: Task[];
  staff: Person[];
  todayIdx: number;
  onPerson: (p: Person) => void;
  onDay: (i: number) => void;
}) {
  const hoursOn = (id: string | null, d: number) =>
    tasks.filter((t) => (t.staff_id ?? null) === id && t.days.includes(d)).reduce((n, t) => n + Number(t.hours ?? 0), 0);
  const weekOf = (id: string | null) =>
    tasks.filter((t) => (t.staff_id ?? null) === id).reduce((n, t) => n + weekHours(t), 0);

  const totals = new Map<string, number>();
  let allHours = 0;
  let unrated = false;
  for (const s of staff) {
    const h = weekOf(s.id);
    allHours += h;
    if (s.hourly_rate === null) {
      if (h > 0) unrated = true;
      continue;
    }
    totals.set(s.currency, (totals.get(s.currency) ?? 0) + h * Number(s.hourly_rate));
  }
  const loose = weekOf(null);

  return (
    <>
      <div className="table-wrap">
        <table className="lines-table clean-grid">
          <thead>
            <tr>
              <th>Person</th>
              {CLEAN_DAYS.map((d, i) => (
                <th key={d} className={i === todayIdx ? "today" : ""}>
                  <button type="button" className="linkish" onClick={() => onDay(i)}>{d}</button>
                </th>
              ))}
              <th>Week</th>
              <th>Rate</th>
              <th>Cost</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => {
              const h = weekOf(s.id);
              return (
                <tr key={s.id}>
                  <td>
                    <button type="button" className="linkish" onClick={() => onPerson(s)}>
                      <i className="dot" style={{ background: s.color }} /> {s.name}
                    </button>
                  </td>
                  {CLEAN_DAYS.map((d, i) => {
                    const v = hoursOn(s.id, i);
                    return (
                      <td key={d} className={i === todayIdx ? "today" : ""}>
                        {v ? qty(v) : <span className="muted">·</span>}
                      </td>
                    );
                  })}
                  <td><strong>{hoursLabel(h)}</strong></td>
                  <td className="muted">
                    {s.hourly_rate === null ? (
                      <button type="button" className="linkish" onClick={() => onPerson(s)}>Set rate</button>
                    ) : (
                      `${money(Number(s.hourly_rate), s.currency)} / h`
                    )}
                  </td>
                  <td>{s.hourly_rate === null ? "—" : money(h * Number(s.hourly_rate), s.currency)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td>Team</td>
              {CLEAN_DAYS.map((d, i) => (
                <td key={d} className={i === todayIdx ? "today" : ""}>
                  {qty(staff.reduce((n, s) => n + hoursOn(s.id, i), 0)) || "·"}
                </td>
              ))}
              <td>{hoursLabel(allHours)}</td>
              <td />
              <td>{[...totals].map(([c, v]) => money(v, c)).join(" + ") || "—"}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="muted" style={{ fontSize: 13.5 }}>
        Cost is each task’s length times the days it runs, at that person’s hourly rate: a typical week.
        {unrated ? " Some people have no rate yet, so the total is partial." : ""}
        {loose ? ` ${hoursLabel(loose)} a week isn’t assigned to anyone.` : ""}
      </p>
    </>
  );
}
